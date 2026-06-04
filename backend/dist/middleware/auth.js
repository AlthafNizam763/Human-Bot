"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const firebase_js_1 = require("../config/firebase.js");
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    // For development ease, if auth is disabled in non-production, we can bypass if key is dummy,
    // but to keep it secure and SaaS production-ready, we verify token.
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing authorization header.' });
    }
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token is empty.' });
    }
    try {
        const decodedToken = await firebase_js_1.auth.verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            role: decodedToken.role || 'user',
        };
        next();
    }
    catch (error) {
        console.error('Firebase auth token verification error:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid or expired token.', details: error.message });
    }
}
