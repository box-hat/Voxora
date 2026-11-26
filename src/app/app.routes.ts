
import { Routes } from '@angular/router';

import { Home } from './pages/home/home';
import { SubmitConcern } from './pages/submit-concern/submit-concern';
import { SubmissionSuccess } from './pages/submission-success/submission-success';
import { TrackConcern } from './pages/track-concern/track-concern';
import { Privacy } from './pages/privacy/privacy';
import { AdminLogin } from './pages/admin-login/admin-login';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { ManageConcerns } from './pages/manage-concerns/manage-concerns';
import { ConcernDetails } from './pages/concern-details/concern-details';
import { Categories } from './pages/categories/categories';
import { Reports } from './pages/reports/reports';
import { adminGuard, guestGuard } from './auth/admin.guard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'submit-concern', component: SubmitConcern },
  { path: 'submission-success', component: SubmissionSuccess },
  { path: 'track-concern', component: TrackConcern },
  { path: 'privacy', component: Privacy },
  { path: 'admin-login', component: AdminLogin, canActivate: [guestGuard] },
  { path: 'admin-dashboard', component: AdminDashboard, canActivate: [adminGuard] },
  { path: 'manage-concerns', component: ManageConcerns, canActivate: [adminGuard] },
  { path: 'concern-details', component: ConcernDetails, canActivate: [adminGuard] },
  { path: 'categories', component: Categories, canActivate: [adminGuard] },
  { path: 'reports', component: Reports, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
