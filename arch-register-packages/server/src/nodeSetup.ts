// Side-effect module: wires up all Node implementations of pluggable services.
// Import from Node entry points and scripts, and list in vitest `setupFiles`.
// Add new service registrations here rather than in each entry point.
import './auth/nodeAuthServicesSetup';
