# Smart Lesson Builder v3

A modern, role-based lesson building application with Supabase authentication and configurable UI.

## Initial Setup

### 1. Install Dependencies
```bash
cd v2
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `v2/` directory with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set Up Database
1. Go to your Supabase project's SQL Editor
2. Copy and run the entire contents of `setup_database.sql`
3. This will create:
   - `profiles` table with role-based access
   - Row Level Security (RLS) policies
   - Trigger to auto-create profiles for new users
   - Admin helper functions

### 4. Create Your First Admin User

**Step 1: Sign Up**
```bash
npm run dev
```
- Visit `http://localhost:5174`
- Click "Sign In" → "Sign Up"
- Create an account with your email and password
- Complete the onboarding (set display name and password)

**Step 2: Make User an Admin**
1. Go to your Supabase dashboard
2. Navigate to **Table Editor** → **profiles**
3. Find your newly created user row
4. Edit the row and set:
   - `role` = `admin`
   - `approved` = `true`
5. Save changes

**Step 3: Verify Admin Access**
- Refresh the app in your browser
- You should now see admin navigation options
- Access the admin dashboard at `/admin-dashboard`

### 5. Run the Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5174`

## Architecture

### Authentication
- **Supabase Auth**: Email/password authentication with session management
- **Profile System**: Consolidated `profiles` table stores user info and roles
- **Onboarding Flow**: New users set display name and password
- **Role-Based Access**: Three roles - `admin`, `designer`, `builder`

### Configuration System

The entire UI is driven by a centralized configuration file at `src/config.js`. This makes the app highly customizable without touching component code.

#### Config Structure

```javascript
export const APP_CONFIG = {
  title: 'Smart Lesson Builder',
  version: 'v3',
  
  // Hero section settings
  hero: {
    title: 'Build Beautiful Lessons in Minutes',
    titleFontSize: '3rem',
    subtitle: 'Create engaging, standards-aligned educational content...',
    marginTop: '15rem', // Vertical positioning
  },
  
  // Authentication page settings
  auth: {
    paddingTop: '8rem',    // Login form vertical position
    formMaxWidth: '28rem', // Login form width
  },
  
  // Header navigation
  header: {
    navigation: [
      { 
        label: 'Create New Lesson', 
        url: '/create-new-lesson', 
        roles: ['builder', 'designer', 'admin'] 
      },
      // ... more nav items
    ],
    button: { label: 'Sign In', url: '/sign-in' },
  },
  
  // Footer links
  footer: {
    links: [
      { label: 'About', url: '/about', roles: null }, // null = public
      { label: 'Documentation', url: '/docs', roles: ['builder', 'designer', 'admin'] },
      // ... more footer links
    ],
  },
  
  // Hero call-to-action buttons
  heroLinks: [
    { 
      label: 'Create a New Lesson', 
      url: '/create-new-lesson', 
      icon: 'sparkles',    // Icon name from lucide-react
      style: 'primary',    // 'primary' or 'secondary'
      roles: ['builder', 'designer', 'admin'] 
    },
    // ... more hero links
  ],
};
```

#### Role-Based Visibility

Links support role-based access control:
- **`roles: null`** - Visible to everyone (including logged-out users)
- **`roles: ['builder', 'designer', 'admin']`** - Visible only to authenticated users with those roles
- **`roles: ['admin']`** - Visible only to admins

The `filterLinksByRole()` utility function (in `src/lib/roleUtils.js`) automatically filters links based on the current user's role.

#### Customizing the UI

To modify the app's appearance and navigation:

1. **Change Navigation**: Edit `header.navigation` array in config
2. **Add Footer Links**: Modify `footer.links` array
3. **Update Hero Buttons**: Adjust `heroLinks` array
4. **Reposition Elements**: Change spacing values like `hero.marginTop` or `auth.paddingTop`
5. **Control Access**: Set appropriate `roles` arrays on any link

All changes take effect immediately without modifying component code.

## Project Structure

```
v2/
├── src/
│   ├── components/
│   │   ├── layout/              # Reusable layout components
│   │   │   ├── Header.jsx       # Top navigation with user menu
│   │   │   ├── Footer.jsx       # Footer with links
│   │   │   ├── Layout.jsx       # Main layout wrapper
│   │   │   └── HeroSection.jsx  # Landing page hero
│   │   └── pages/               # Page-level components
│   │       ├── HomePage.jsx
│   │       ├── Login.jsx
│   │       ├── SetDisplayName.jsx
│   │       ├── SetPassword.jsx
│   │       └── PlaceholderPage.jsx
│   ├── lib/
│   │   ├── supabaseClient.js    # Supabase initialization
│   │   └── roleUtils.js         # Role-based filtering utilities
│   ├── styles/
│   │   └── HomePage.css         # Global styles
│   ├── config.js                # 🎯 Central configuration
│   └── App.jsx                  # Main app with auth logic
├── migrate_consolidate_tables.sql  # Database migration script
└── .env                         # Environment variables (Supabase keys)
```

## Database Setup

The database schema is defined in `setup_database.sql`. This creates:

**Profiles Table:**
- `id` (UUID) - References auth.users
- `display_name` (TEXT) - User's display name
- `role` (TEXT) - User role: 'admin', 'designer', or 'builder'
- `approved` (BOOLEAN) - Whether user has been approved
- `pending_role` (TEXT) - Role requested during signup (optional)
- `created_at` / `updated_at` - Timestamps

**Row Level Security:**
- Users can view and update their own profile
- Admins can view and update all profiles

**Triggers & Functions:**
- Auto-creates profile when new user signs up
- Admin helper functions for user management
- Timestamp update triggers

## Features

- ✅ **Supabase Authentication** - Secure email/password login
- ✅ **Role-Based Access Control** - Three-tier permission system
- ✅ **Configurable UI** - Central config file controls entire interface
- ✅ **Responsive Design** - Mobile-first with hamburger menu
- ✅ **User Profiles** - Display names with consolidated role management
- ✅ **Dropdown User Menu** - Clean header with admin dashboard access
- ✅ **Protected Routes** - Automatic link filtering by role
- ✅ **Modern Gradient Design** - Purple gradient hero with styled buttons

## Next Steps

Functionality will be added incrementally:
- Lesson creation interface
- Lesson type builder
- Template management
- Admin dashboard
