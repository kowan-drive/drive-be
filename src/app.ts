import { Hono } from 'hono';
import auth from './modules/auth/auth.route';
import files from './modules/files/files.route';
import folders from './modules/folders/folders.route';
import shares from './modules/shares/shares.route';
import subscriptions from './modules/subscriptions/subscriptions.route';

const app = new Hono();

app.get('/', (c) => c.json({
    message: 'Welcome to MiniDrive API',
    version: '1.0.0',
    description: 'Privacy-first cloud storage with WebAuthn authentication and SSE-C encryption',
}));

// Register routes
app.route('/auth', auth);
app.route('/files', files);
app.route('/folders', folders);
app.route('/shares', shares);
app.route('/subscriptions', subscriptions);

export default app;
