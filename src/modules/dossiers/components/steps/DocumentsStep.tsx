/**
 * @file src/modules/dossiers/components/steps/DocumentsStep.tsx
 * @description Step 4 — Document upload
 *
 * Allows users to upload documents related to the dossier.
 * 
 * Accepted file types:
 * - Documents: .pdf, .doc, .docx, .txt
 * - Spreadsheets: .xlsx, .xls
 * - Images: .png, .jpg, .jpeg, .gif, .webp
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { useRef, useState, useCallback, type ReactElement, type DragEvent, type ChangeEvent } from 'react';
import {
  File,
  FileText,
  FileSpreadsheet,
  Image,
  Paperclip,
  UploadCloud,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Accepted MIME types and extensions
 * Explicitly excluding dangerous file types (executables, scripts, etc.)
 */
const ACCEPTED_EXTENSIONS = [
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

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

/**
 * File info for display purposes
 */
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

/**
 * Document upload step data
 */
export interface DocumentsStepData {
  files: UploadedFile[];
}

interface DocumentsStepProps {
  data: DocumentsStepData;
  onChange: (data: DocumentsStepData) => void;
  errors?: Record<string, string>;
}

/**
 * Format file size for display (KB, MB)
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file type label for display
 */
function getFileTypeLabel(type: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  
  if (type === 'application/pdf' || ext === 'pdf') return 'PDF';
  if (type.includes('word') || ext === 'doc' || ext === 'docx') return 'Word';
  if (type === 'text/plain' || ext === 'txt') return 'Texte';
  if (type.includes('spreadsheet') || type.includes('excel') || ext === 'xlsx' || ext === 'xls') return 'Excel';
  if (type.startsWith('image/')) return 'Image';
  
  return ext?.toUpperCase() || 'Fichier';
}

/**
 * Get icon for file type
 */
function getFileIcon(type: string, name: string): ReactElement {
  const ext = name.split('.').pop()?.toLowerCase();
  const cls = 'w-5 h-5 flex-shrink-0 text-muted-foreground';

  if (type === 'application/pdf' || ext === 'pdf') return <FileText className={cls} />;
  if (type.includes('word') || ext === 'doc' || ext === 'docx') return <FileText className={cls} />;
  if (type === 'text/plain' || ext === 'txt') return <File className={cls} />;
  if (type.includes('spreadsheet') || type.includes('excel') || ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className={cls} />;
  if (type.startsWith('image/')) return <Image className={cls} />;

  return <Paperclip className={cls} />;
}

/**
 * Check if file type is accepted
 */
function isFileAccepted(file: File): boolean {
  const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
  return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
}

/**
 * Generate unique ID for file
 */
function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Documents Step component.
 * Handles file upload via drag-and-drop or file picker.
 */
export function DocumentsStep({
  data,
  onChange,
  errors = {},
}: DocumentsStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);

  /**
   * Process files and add valid ones to the list
   */
  const processFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: UploadedFile[] = [];
    const rejected: string[] = [];

    Array.from(fileList).forEach((file) => {
      if (isFileAccepted(file)) {
        newFiles.push({
          id: generateFileId(),
          name: file.name,
          size: file.size,
          type: file.type,
          file: file,
        });
      } else {
        rejected.push(file.name);
      }
    });

    if (rejected.length > 0) {
      setRejectedFiles(rejected);
      // Clear rejected files message after 5 seconds
      setTimeout(() => setRejectedFiles([]), 5000);
    }

    if (newFiles.length > 0) {
      onChange({
        ...data,
        files: [...data.files, ...newFiles],
      });
    }
  }, [data, onChange]);

  /**
   * Handle file input change
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle drag events
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  /**
   * Open file picker
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Remove a file from the list
   */
  const handleRemoveFile = (fileId: string) => {
    onChange({
      ...data,
      files: data.files.filter((f) => f.id !== fileId),
    });
  };

  return (
    <Card className="pl-1 border border-border ring-0">
      <CardHeader>
        <CardTitle>Étape 4 — Dépôt de documents</CardTitle>
        <CardDescription>
          Ajoutez les documents nécessaires au dossier
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Drop zone */}
        <div
          className={`
            relative flex flex-col items-center justify-center 
            min-h-[200px] p-8 
            border-2 border-dashed rounded-lg 
            transition-colors duration-200 cursor-pointer
            ${isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          {/* Upload icon */}
          <div className="mb-4">
            <UploadCloud
              className={`w-10 h-10 transition-colors duration-200 ${
                isDragging ? 'text-primary' : 'text-muted-foreground/50'
              }`}
            />
          </div>

          {/* Instructions */}
          <p className="mb-2 text-sm font-medium text-center text-foreground">
            {isDragging
              ? 'Déposez vos fichiers ici'
              : 'Glissez-déposez vos fichiers ici'
            }
          </p>
          <p className="text-xs text-muted-foreground">
            ou cliquez pour parcourir
          </p>

          {/* Accepted formats */}
          <div className="mt-4 text-xs text-center text-muted-foreground">
            <span className="font-medium">Formats acceptés:</span>{' '}
            PDF, Word, Excel, Images, Texte
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileChange}
            className="hidden"
            aria-label="Sélectionner des fichiers"
          />
        </div>

        {/* Rejected files warning */}
        {rejectedFiles.length > 0 && (
          <div className="p-3 text-sm border rounded-lg bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400">
            <span className="font-medium">Fichiers non acceptés:</span>{' '}
            {rejectedFiles.join(', ')}
            <p className="mt-1 text-xs">
              Seuls les fichiers PDF, Word, Excel, images et texte sont autorisés.
            </p>
          </div>
        )}

        {/* Global error */}
        {errors.files && (
          <div className="p-3 text-sm border rounded-lg bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400">
            {errors.files}
          </div>
        )}

        {/* File list */}
        {data.files.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Fichiers sélectionnés ({data.files.length})
            </h4>

            <div className="space-y-2">
              {data.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 border-border"
                >
                  {/* File icon */}
                  <span className="flex-shrink-0">
                    {getFileIcon(file.type, file.name)}
                  </span>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getFileTypeLabel(file.type, file.name)} • {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Remove button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(file.id);
                    }}
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Supprimer ${file.name}`}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            {/* Clear all button */}
            {data.files.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...data, files: [] })}
                className="text-muted-foreground"
              >
                Tout supprimer
              </Button>
            )}
          </div>
        )}

        {/* Empty state hint */}
        {data.files.length === 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Aucun fichier sélectionné
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Default data for document upload step
 */
export const DEFAULT_DOCUMENTS_DATA: DocumentsStepData = {
  files: [],
};
