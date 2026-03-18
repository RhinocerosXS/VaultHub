import { AuthenticatedUser } from '../auth/jwt.strategy';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
