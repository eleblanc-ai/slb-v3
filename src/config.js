export const APP_CONFIG = {
  title: 'Smart Lesson Builder',
  version: 'v3',
  hero: {
    title: 'Build Beautiful Lessons in Minutes',
    titleFontSize: '3rem',
    subtitle: 'Create engaging, standards-aligned educational content with the help of generative AI.',
    marginTop: '5rem', // Adjust this value as needed for more/less space above hero
  },
  auth: {
    paddingTop: '8rem', // Vertical position of login/auth forms - increase to move down, decrease to move up
    formMaxWidth: '28rem', // Width of the auth forms
  },
  fontSizes: {
    heroTitle: '2.5rem',
    button: '1rem',
    nav: '1rem',
  },
  header: {
    navigation: [
    ],
    button: { label: 'Sign In', url: '/sign-in' },
    userMenu: [
      { label: 'Admin Dashboard', url: '/admin', icon: 'shield', roles: ['admin'] },
      { label: 'Sign Out', action: 'logout', icon: 'logout' }, // action instead of url for special handlers
    ],
  },
  footer: {
    links: [
      { label: 'ThinkCERCA @2026', url: 'https://www.thinkcerca.com/', roles: ['builder','admin'] },
      { label: 'Privacy', url: '/privacy', roles: [] },
    ],
  },
  heroLinks: [
    { label: 'Create a New Lesson', url: '/browse-lesson-templates?mode=create', icon: 'sparkles', style: 'primary', roles: ['builder', 'designer', 'admin'] },
    { label: 'Browse Lessons', url: '/browse-lessons', icon: 'files', style: 'secondary', roles: ['builder', 'designer', 'admin'] },
    { label: 'Create a New Lesson Template', url: '/create-new-lesson-type', icon: 'layout', style: 'primary', roles: ['admin'] },
    { label: 'Browse Lesson Templates', url: '/browse-lesson-templates?mode=edit', icon: 'files', style: 'secondary', roles: ['admin'] }
  ],
  pages: {
    createNewLessonType: {
      subtitle: 'Define the structure and fields for your lesson template.',
    },
  },  modals: {
    backdropBlur: '8px', // Blur amount for modal backdrops
  },};
