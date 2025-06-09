import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { API_URL } from '@/config';

const DebugPanel: React.FC = () => {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      config: {
        apiUrl: API_URL,
        currentUrl: window.location.href,
        origin: window.location.origin
      },
      localStorage: {
        token: localStorage.getItem('token')?.substring(0, 50) + '...' || 'None',
        userRole: localStorage.getItem('user_role') || 'None',
        userId: localStorage.getItem('user_id') || 'None'
      },
      tests: {}
    };

    // Test 1: Health Check
    try {
      const healthResponse = await fetch(`${API_URL}/health`);
      diagnostics.tests.health = {
        status: healthResponse.status,
        ok: healthResponse.ok,
        data: await healthResponse.json()
      };
    } catch (error: any) {
      diagnostics.tests.health = {
        error: error.message
      };
    }

    // Test 2: Login Test
    try {
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'subrahmanyag79@gmail.com',
          password: 'Subbu@2004'
        })
      });

      const loginData = await loginResponse.json();
      diagnostics.tests.login = {
        status: loginResponse.status,
        ok: loginResponse.ok,
        hasToken: !!loginData.access_token,
        tokenPreview: loginData.access_token?.substring(0, 50) + '...' || 'None'
      };

      // Test 3: Admin API with fresh token
      if (loginData.access_token) {
        try {
          const adminResponse = await fetch(`${API_URL}/api/admin/dashboard/stats`, {
            headers: {
              'Authorization': `Bearer ${loginData.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          diagnostics.tests.adminApi = {
            status: adminResponse.status,
            ok: adminResponse.ok,
            data: adminResponse.ok ? await adminResponse.json() : await adminResponse.text()
          };
        } catch (error: any) {
          diagnostics.tests.adminApi = {
            error: error.message
          };
        }
      }

    } catch (error: any) {
      diagnostics.tests.login = {
        error: error.message
      };
    }

    // Test 4: Test with current stored token
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      try {
        const currentTokenResponse = await fetch(`${API_URL}/api/admin/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        });

        diagnostics.tests.currentToken = {
          status: currentTokenResponse.status,
          ok: currentTokenResponse.ok,
          data: currentTokenResponse.ok ? await currentTokenResponse.json() : await currentTokenResponse.text()
        };
      } catch (error: any) {
        diagnostics.tests.currentToken = {
          error: error.message
        };
      }
    } else {
      diagnostics.tests.currentToken = {
        error: 'No token in localStorage'
      };
    }

    setResults(diagnostics);
    setLoading(false);
  };

  const clearStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    alert('Storage cleared! Please refresh the page and login again.');
  };

  const fixLogin = async () => {
    try {
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'subrahmanyag79@gmail.com',
          password: 'Subbu@2004'
        })
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        localStorage.setItem('token', loginData.access_token);
        localStorage.setItem('user_role', loginData.user.role);
        localStorage.setItem('user_id', loginData.user.id);
        alert('Login successful! Refreshing page...');
        window.location.reload();
      } else {
        alert('Login failed: ' + await loginResponse.text());
      }
    } catch (error: any) {
      alert('Login error: ' + error.message);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>🔧 Frontend-Backend Connection Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={runDiagnostics} disabled={loading}>
            {loading ? 'Running...' : 'Run Diagnostics'}
          </Button>
          <Button variant="outline" onClick={clearStorage}>
            Clear Storage
          </Button>
          <Button variant="default" onClick={fixLogin}>
            Fix Login
          </Button>
        </div>

        {results && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Configuration</h3>
              <div className="bg-gray-100 p-3 rounded text-sm">
                <div><strong>API URL:</strong> {results.config.apiUrl}</div>
                <div><strong>Current URL:</strong> {results.config.currentUrl}</div>
                <div><strong>Origin:</strong> {results.config.origin}</div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Local Storage</h3>
              <div className="bg-gray-100 p-3 rounded text-sm">
                <div><strong>Token:</strong> {results.localStorage.token}</div>
                <div><strong>User Role:</strong> {results.localStorage.userRole}</div>
                <div><strong>User ID:</strong> {results.localStorage.userId}</div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Test Results</h3>
              <div className="space-y-2">
                {Object.entries(results.tests).map(([testName, result]: [string, any]) => (
                  <div key={testName} className="flex items-center gap-2">
                    <Badge variant={result.ok || (!result.error && result.status === 200) ? "default" : "destructive"}>
                      {testName}
                    </Badge>
                    <span className="text-sm">
                      {result.error ? `❌ ${result.error}` : 
                       result.ok ? `✅ ${result.status}` : 
                       `⚠️ ${result.status}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">View Full Results</summary>
              <pre className="bg-gray-100 p-3 rounded mt-2 overflow-auto max-h-96">
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DebugPanel; 