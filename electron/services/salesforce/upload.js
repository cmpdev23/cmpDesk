/**
 * electron/services/salesforce/upload.js
 * ========================================
 * Document upload service for OpenText Content Server (xECM).
 *
 * Workflow:
 * 1. Fetch OTDS token via Aura API (getPerspectiveParameters)
 * 2. Extract workspace node ID from response
 * 3. Upload each document to OpenText via REST API v2
 *
 * Security:
 * - OTDS token is NEVER logged or exposed to renderer
 * - All upload operations happen in main process only
 *
 * @see docs/files.md - xECM discovery documentation
 * @see model/lib/upload_documents.js - Reference implementation
 */

const { log } = require('../../lib/logger');
const auraClient = require('./aura-client');

// ============================================================================
// CONSTANTS
// ============================================================================

const OPENTEXT_BASE_URL = 'https://otcs.ia.ca/cs/cs';
const OPENTEXT_API_V2 = `${OPENTEXT_BASE_URL}/api/v2`;

const DESCRIPTOR_GET_PERSPECTIVE =
  'apex://xecm.CanvasAppController/ACTION$getPerspectiveParameters';

/**
 * Maximum file size allowed (25 MB)
 */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Allowed file extensions (matching DocumentUploadStep.tsx)
 */
const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.xlsx',
  '.xls',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
];

/**
 * Content types by extension
 */
const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sanitize filename for OpenText (remove problematic characters)
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  // Replace problematic characters with underscores
  // Keep alphanumeric, dots, hyphens, underscores
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200); // Limit length
}

/**
 * Get content type from filename extension
 * @param {string} filename - Filename with extension
 * @returns {string} MIME content type
 */
function getContentType(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

/**
 * Check if file extension is allowed
 * @param {string} filename - Filename to check
 * @returns {boolean}
 */
function isExtensionAllowed(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// ============================================================================
// OTDS TOKEN FETCH
// ============================================================================

/**
 * Fetch OTDS token via Aura API.
 * This is the key to authenticate with OpenText Content Server.
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {object} credentials - Aura credentials
 * @param {string} caseId - Salesforce Case ID
 * @returns {Promise<{success: boolean, token?: string, nodeId?: string, error?: string}>}
 */
async function fetchOtdsToken(page, credentials, caseId) {
  log.debug('UPLOAD', 'Fetching OTDS token for case', { caseId });

  try {
    // Build the Aura message for getPerspectiveParameters
    const message = {
      actions: [
        {
          id: '1',
          descriptor: DESCRIPTOR_GET_PERSPECTIVE,
          callingDescriptor: 'UNKNOWN',
          params: {
            recordId: caseId,
            removeCSHeader: false,
            perspectiveType: 'Workspace',
            parameters: '',
          },
        },
      ],
    };

    const response = await auraClient.call(page, credentials, message);

    // Check for Aura errors
    if (!response || !response.actions || response.actions.length === 0) {
      return { success: false, error: 'Empty Aura response' };
    }

    const action = response.actions[0];
    
    if (action.state !== 'SUCCESS') {
      const errorMsg = action.error?.[0]?.message || 'Aura action failed';
      return { success: false, error: errorMsg };
    }

    // Parse the JSON string returned by getPerspectiveParameters
    let params;
    try {
      params = JSON.parse(action.returnValue);
    } catch (e) {
      return { success: false, error: 'Failed to parse getPerspectiveParameters response' };
    }

    if (!params.token) {
      return { success: false, error: 'No token in response - workspace may not exist yet' };
    }

    // Extract node ID from perspectiveUrl
    let nodeId = null;
    if (params.perspectiveUrl) {
      const match = params.perspectiveUrl.match(/\/nodes\/(\d+)/);
      if (match) {
        nodeId = match[1];
      }
    }

    if (!nodeId) {
      return { success: false, error: 'Workspace node ID not found in response' };
    }

    log.debug('UPLOAD', 'OTDS token obtained', { nodeId });

    return {
      success: true,
      token: params.token,
      nodeId: nodeId,
    };
  } catch (e) {
    log.error('UPLOAD', 'Error fetching OTDS token', { error: e.message });
    return { success: false, error: e.message };
  }
}

// ============================================================================
// SINGLE DOCUMENT UPLOAD
// ============================================================================

/**
 * Upload a single document to OpenText Content Server.
 *
 * @param {object} options - Upload options
 * @param {string} options.fileName - Name of the file
 * @param {Buffer} options.fileBuffer - File content as Buffer
 * @param {string} options.parentNodeId - Parent node ID (workspace)
 * @param {string} options.otdsToken - OTDS SSO token
 * @returns {Promise<{success: boolean, nodeId?: string, fileName: string, error?: string}>}
 */
async function uploadSingleDocument({ fileName, fileBuffer, parentNodeId, otdsToken }) {
  const sanitizedName = sanitizeFilename(fileName);
  const contentType = getContentType(fileName);

  log.debug('UPLOAD', 'Uploading document', { fileName: sanitizedName, size: fileBuffer.length });

  // Build multipart form data manually
  const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
  const parts = [];

  // type=144 (Document type in OpenText)
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="type"\r\n\r\n` +
    `144\r\n`
  );

  // parent_id
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="parent_id"\r\n\r\n` +
    `${parentNodeId}\r\n`
  );

  // name
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="name"\r\n\r\n` +
    `${sanitizedName}\r\n`
  );

  // file
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${sanitizedName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );

  // Combine parts with file content
  const preamble = Buffer.from(parts.join(''), 'utf8');
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([preamble, fileBuffer, epilogue]);

  try {
    const response = await fetch(`${OPENTEXT_API_V2}/nodes`, {
      method: 'POST',
      headers: {
        OTDSTicket: otdsToken,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Accept: 'application/json',
      },
      body: body,
    });

    const responseText = await response.text();

    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        // Extract node ID from nested response structure
        const nodeId = result.results?.data?.properties?.id || result.id;
        log.info('UPLOAD', 'Document uploaded successfully', { fileName: sanitizedName, nodeId });
        return {
          success: true,
          nodeId: nodeId,
          fileName: sanitizedName,
        };
      } catch {
        // Response OK but couldn't parse - still success
        log.info('UPLOAD', 'Document uploaded (no node ID in response)', { fileName: sanitizedName });
        return {
          success: true,
          fileName: sanitizedName,
        };
      }
    } else {
      // Handle specific error codes
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Use status text
      }

      log.error('UPLOAD', 'Document upload failed', { fileName: sanitizedName, status: response.status, error: errorMessage });
      return {
        success: false,
        fileName: sanitizedName,
        error: errorMessage,
      };
    }
  } catch (e) {
    log.error('UPLOAD', 'Document upload error', { fileName: sanitizedName, error: e.message });
    return {
      success: false,
      fileName: sanitizedName,
      error: e.message,
    };
  }
}

// ============================================================================
// MAIN UPLOAD FUNCTION
// ============================================================================

/**
 * Upload documents to OpenText Content Server.
 *
 * This is the main entry point for document uploads.
 * It handles:
 * - OTDS token acquisition
 * - Workspace node ID extraction
 * - Sequential upload of all documents
 * - Token refresh on 401 errors
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {object} credentials - Aura credentials
 * @param {object} options - Upload options
 * @param {string} options.caseId - Salesforce Case ID
 * @param {Array<{name: string, type: string, size: number, buffer: number[]}>} options.files - Files to upload
 * @returns {Promise<UploadDocumentsResult>}
 */
async function uploadDocuments(page, credentials, { caseId, files }) {
  log.info('UPLOAD', 'Starting document upload', { caseId, fileCount: files.length });

  const result = {
    success: false,
    uploadedCount: 0,
    failedCount: 0,
    results: [],
    error: null,
  };

  // ── Validate inputs ─────────────────────────────────────────────────────────
  if (!caseId) {
    result.error = 'caseId is required';
    return result;
  }

  if (!files || files.length === 0) {
    result.error = 'No files provided';
    return result;
  }

  // ── Validate files ──────────────────────────────────────────────────────────
  for (const file of files) {
    if (!isExtensionAllowed(file.name)) {
      result.error = `File type not allowed: ${file.name}`;
      return result;
    }
    if (file.size > MAX_FILE_SIZE) {
      result.error = `File too large (max 25 MB): ${file.name}`;
      return result;
    }
  }

  // ── Fetch OTDS token ────────────────────────────────────────────────────────
  log.info('UPLOAD', 'Fetching OTDS token...');
  
  let tokenResult = await fetchOtdsToken(page, credentials, caseId);

  if (!tokenResult.success) {
    // Retry once after a short delay (workspace might not be ready yet)
    log.warn('UPLOAD', 'Token fetch failed, retrying in 3s...', { error: tokenResult.error });
    await new Promise(r => setTimeout(r, 3000));
    tokenResult = await fetchOtdsToken(page, credentials, caseId);
  }

  if (!tokenResult.success) {
    result.error = `Failed to get OTDS token: ${tokenResult.error}`;
    result.failedCount = files.length;
    return result;
  }

  const { token: otdsToken, nodeId: workspaceNodeId } = tokenResult;
  result.workspaceNodeId = workspaceNodeId;

  // ── Upload each document sequentially ───────────────────────────────────────
  log.info('UPLOAD', `Uploading ${files.length} document(s) to workspace ${workspaceNodeId}`);

  for (const file of files) {
    // Convert number array back to Buffer
    const fileBuffer = Buffer.from(file.buffer);

    const uploadResult = await uploadSingleDocument({
      fileName: file.name,
      fileBuffer,
      parentNodeId: workspaceNodeId,
      otdsToken,
    });

    result.results.push({
      fileName: file.name,
      success: uploadResult.success,
      nodeId: uploadResult.nodeId,
      error: uploadResult.error,
    });

    if (uploadResult.success) {
      result.uploadedCount++;
    } else {
      result.failedCount++;

      // If 401, try to refresh token and retry this file
      if (uploadResult.error && uploadResult.error.includes('401')) {
        log.warn('UPLOAD', 'Token expired, refreshing...');
        const refreshResult = await fetchOtdsToken(page, credentials, caseId);
        
        if (refreshResult.success) {
          // Retry the upload
          const retryResult = await uploadSingleDocument({
            fileName: file.name,
            fileBuffer,
            parentNodeId: workspaceNodeId,
            otdsToken: refreshResult.token,
          });

          // Update the result
          const lastIdx = result.results.length - 1;
          result.results[lastIdx] = {
            fileName: file.name,
            success: retryResult.success,
            nodeId: retryResult.nodeId,
            error: retryResult.error,
          };

          if (retryResult.success) {
            result.uploadedCount++;
            result.failedCount--;
          }
        }
      }
    }
  }

  // ── Set final success status ────────────────────────────────────────────────
  result.success = result.failedCount === 0;

  if (result.failedCount > 0) {
    result.error = `${result.failedCount} document(s) failed to upload`;
  }

  log.info('UPLOAD', 'Document upload complete', {
    uploadedCount: result.uploadedCount,
    failedCount: result.failedCount,
  });

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  uploadDocuments,
  fetchOtdsToken,
  uploadSingleDocument,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
};

/**
 * @typedef {object} UploadDocumentsResult
 * @property {boolean} success - True if all documents uploaded
 * @property {number} uploadedCount - Number of successfully uploaded documents
 * @property {number} failedCount - Number of failed uploads
 * @property {string} [workspaceNodeId] - OpenText workspace node ID
 * @property {Array<{fileName: string, success: boolean, nodeId?: string, error?: string}>} results - Individual results
 * @property {string|null} error - Error message if any failures
 */
