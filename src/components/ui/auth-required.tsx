/**
 * @file src/components/ui/auth-required.tsx
 * @description Component displayed when authentication is required.
 * 
 * Shows a clear message to the user that they need to connect
 * before accessing the feature. Includes a login button that
 * triggers the Salesforce authentication flow.
 * 
 * Usage:
 *   <AuthRequired onLoginClick={handleLogin} />
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface AuthRequiredProps {
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Whether login is in progress */
  isLoggingIn?: boolean;
  /** Error message from login attempt */
  loginError?: string | null;
  /** Callback when login button is clicked */
  onLoginClick?: () => void;
}

/**
 * AuthRequired component - displays when user needs to authenticate
 * 
 * @example
 *   <AuthRequired 
 *     onLoginClick={() => window.electronAPI.auth.login()}
 *   />
 */
export function AuthRequired({
  title = 'Connexion requise',
  description = 'Vous devez être connecté à Salesforce pour accéder à cette fonctionnalité.',
  isLoggingIn = false,
  loginError = null,
  onLoginClick,
}: AuthRequiredProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-md border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>

          <CardTitle className="text-amber-800 dark:text-amber-200">
            {title}
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Login Error */}
          {loginError && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/30 dark:text-red-300">
              {loginError}
            </div>
          )}

          {/* Login Button */}
          {onLoginClick && (
            <Button
              onClick={onLoginClick}
              disabled={isLoggingIn}
              className="w-full"
              size="lg"
            >
              {isLoggingIn ? (
                <>
                  <span className="mr-2 animate-spin">⏳</span>
                  Connexion en cours...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  Se connecter à Salesforce
                </>
              )}
            </Button>
          )}

          {/* Help text */}
          <p className="text-xs text-center text-muted-foreground">
            Une fenêtre de navigateur s'ouvrira pour l'authentification.
            <br />
            Complétez la connexion, puis cette page se mettra à jour automatiquement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthRequired;
