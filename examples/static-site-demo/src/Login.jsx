import { useKeycloak } from "@react-keycloak/web";

export default function Login() {
    const { keycloak } = useKeycloak();

    return (
        <div className="login-card">
            <h2>Welcome to MATRIC</h2>
            <p>Please login to continue</p>
            
            <button 
                className="btn btn-primary"
                onClick={() => keycloak.login()}
            >
                Login with Keycloak
            </button>
            
            <div className="test-accounts">
                <h3>Test Accounts:</h3>
                <div className="account-list">
                    <div className="account">
                        <strong>Admin:</strong> admin@matric.local / admin123
                    </div>
                    <div className="account">
                        <strong>Developer:</strong> developer@matric.local / dev123
                    </div>
                    <div className="account">
                        <strong>Viewer:</strong> viewer@matric.local / view123
                    </div>
                </div>
            </div>
        </div>
    );
}