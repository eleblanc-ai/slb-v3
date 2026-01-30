// Utility function to filter links based on user role
export const filterLinksByRole = (links, userRole, isAuthenticated) => {
  return links.filter(link => {
    // If roles is null, link is visible to everyone (including unauthenticated users)
    if (link.roles === null) {
      return true;
    }
    
    // If roles array exists but user is not authenticated, hide the link
    if (link.roles && !isAuthenticated) {
      return false;
    }
    
    // If roles array exists and user is authenticated, check if user's role is in the allowed roles
    if (link.roles && Array.isArray(link.roles)) {
      return link.roles.includes(userRole);
    }
    
    // Default: show the link
    return true;
  });
};
