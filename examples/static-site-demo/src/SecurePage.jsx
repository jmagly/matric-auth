import { useKeycloak } from "@react-keycloak/web";

export default function SecurePage() {
    const { keycloak } = useKeycloak();
    
    const username = keycloak.tokenParsed?.preferred_username || keycloak.tokenParsed?.email;
    const email = keycloak.tokenParsed?.email;
    const roles = keycloak.tokenParsed?.realm_access?.roles || [];
    
    return (
        <div className="user-card">
            <h2>Welcome, {username}! ✅</h2>
            <p>You are successfully authenticated with Keycloak</p>
            
            <div className="user-details">
                <h3>User Information:</h3>
                <table>
                    <tbody>
                        <tr>
                            <td><strong>Username:</strong></td>
                            <td>{username}</td>
                        </tr>
                        <tr>
                            <td><strong>Email:</strong></td>
                            <td>{email}</td>
                        </tr>
                        <tr>
                            <td><strong>User ID:</strong></td>
                            <td>{keycloak.tokenParsed?.sub}</td>
                        </tr>
                        <tr>
                            <td><strong>Roles:</strong></td>
                            <td>{roles.join(', ')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div className="role-check">
                <h3>Role-Based Access:</h3>
                <div className="roles">
                    <div className={`role-badge ${keycloak.hasRealmRole('admin') ? 'active' : 'inactive'}`}>
                        Admin: {keycloak.hasRealmRole('admin') ? '✓' : '✗'}
                    </div>
                    <div className={`role-badge ${keycloak.hasRealmRole('developer') ? 'active' : 'inactive'}`}>
                        Developer: {keycloak.hasRealmRole('developer') ? '✓' : '✗'}
                    </div>
                    <div className={`role-badge ${keycloak.hasRealmRole('viewer') ? 'active' : 'inactive'}`}>
                        Viewer: {keycloak.hasRealmRole('viewer') ? '✓' : '✗'}
                    </div>
                </div>
            </div>
            
            <div className="api-test">
                <h3>Access Token (for API calls):</h3>
                <div className="token-display">
                    <code>{keycloak.token?.substring(0, 50)}...</code>
                </div>
            </div>
            
            <div className="actions">
                <button 
                    className="btn btn-secondary"
                    onClick={() => keycloak.accountManagement()}
                >
                    Manage Account
                </button>
                <button 
                    className="btn btn-danger"
                    onClick={() => keycloak.logout()}
                >
                    Logout
                </button>
            </div>
        </div>
    );
}