import { useKeycloak } from "@react-keycloak/web";
import Login from "./Login";

export default function SecurityGuy({ children }) {
    const { keycloak, initialized } = useKeycloak();

    // Show loading while Keycloak is initializing
    if (!initialized) {
        return (
            <div className="loading">
                <h2>Initializing authentication...</h2>
            </div>
        );
    }

    const isLoggedIn = keycloak.authenticated;

    return isLoggedIn ? children : <Login />;
}