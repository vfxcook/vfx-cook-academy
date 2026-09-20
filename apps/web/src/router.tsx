import { createBrowserRouter } from 'react-router';
import BootFallback from './components/BootFallback';
import RootLayout, { rootLoader } from './routes/rootLayout';
import RouteError from './routes/routeError';

import Home, { homeLoader } from './routes/home';
import Courses, { coursesLoader } from './routes/courses';
import Course, { courseLoader } from './routes/course';
import Checkout, { checkoutLoader } from './routes/checkout';
import Classroom, { classroomIndexLoader, classroomLoader } from './routes/classroom';
import Community, { communityLoader } from './routes/community';
import Dashboard, { dashboardLoader } from './routes/dashboard';
import Profile, { profileLoader } from './routes/profile';
import Studio, { studioLoader } from './routes/studio';
import SignIn, { signInLoader } from './routes/signIn';
import SignUp, { signUpLoader } from './routes/signUp';
import SignInLink, { signInLinkLoader } from './routes/signInLink';
import { GiftRedeem, GiftSuccess, giftLoader, giftRedeemLoader } from './routes/gift';

import AdminLayout, { adminLoader } from './routes/admin/layout';
import AdminOverview, { adminOverviewLoader } from './routes/admin/overview';
import AdminCourses, { adminCoursesLoader } from './routes/admin/courses';
import AdminLessons, { adminLessonsLoader } from './routes/admin/lessons';
import AdminStudents, { adminStudentsLoader } from './routes/admin/students';
import AdminPayments, { adminPaymentsLoader } from './routes/admin/payments';
import AdminPrompts, { adminPromptsLoader } from './routes/admin/prompts';
import AdminStudio, { adminStudioLoader } from './routes/admin/studio';

const hydrateFallbackElement = <BootFallback />;
const errorElement = <RouteError />;

export const router = createBrowserRouter([
  // The auth scenes are full-bleed and deliberately sit outside the app chrome.
  {
    path: '/sign-in',
    element: <SignIn />,
    loader: signInLoader,
    hydrateFallbackElement,
    errorElement
  },
  {
    path: '/sign-in/link',
    element: <SignInLink />,
    loader: signInLinkLoader,
    hydrateFallbackElement,
    errorElement
  },
  {
    path: '/sign-up',
    element: <SignUp />,
    loader: signUpLoader,
    hydrateFallbackElement,
    errorElement
  },
  {
    id: 'root',
    path: '/',
    element: <RootLayout />,
    loader: rootLoader,
    hydrateFallbackElement,
    errorElement,
    children: [
      { index: true, element: <Home />, loader: homeLoader, errorElement },
      { path: 'courses', element: <Courses />, loader: coursesLoader, errorElement },
      { path: 'courses/:slug', element: <Course />, loader: courseLoader, errorElement },
      { path: 'checkout/:slug', element: <Checkout />, loader: checkoutLoader, errorElement },

      { path: 'learn/:slug', loader: classroomIndexLoader, errorElement },
      { path: 'learn/:slug/community', element: <Community />, loader: communityLoader, errorElement },
      {
        path: 'learn/:slug/:lessonId',
        element: <Classroom />,
        loader: classroomLoader,
        errorElement
      },

      { path: 'dashboard', element: <Dashboard />, loader: dashboardLoader, errorElement },
      { path: 'profile', element: <Profile />, loader: profileLoader, errorElement },
      { path: 'studio', element: <Studio />, loader: studioLoader, errorElement },

      { path: 'gift/redeem', element: <GiftRedeem />, loader: giftRedeemLoader, errorElement },
      { path: 'gift/:id', element: <GiftSuccess />, loader: giftLoader, errorElement },

      {
        path: 'admin',
        element: <AdminLayout />,
        loader: adminLoader,
        errorElement,
        children: [
          { index: true, element: <AdminOverview />, loader: adminOverviewLoader, errorElement },
          { path: 'courses', element: <AdminCourses />, loader: adminCoursesLoader, errorElement },
          { path: 'lessons', element: <AdminLessons />, loader: adminLessonsLoader, errorElement },
          { path: 'students', element: <AdminStudents />, loader: adminStudentsLoader, errorElement },
          { path: 'payments', element: <AdminPayments />, loader: adminPaymentsLoader, errorElement },
          { path: 'prompts', element: <AdminPrompts />, loader: adminPromptsLoader, errorElement },
          { path: 'studio', element: <AdminStudio />, loader: adminStudioLoader, errorElement }
        ]
      },

      { path: '*', element: <RouteError /> }
    ]
  }
]);
