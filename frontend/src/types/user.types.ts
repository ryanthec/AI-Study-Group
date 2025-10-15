export interface Profile {
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  location?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    studyGroupInvites: boolean;
    mentions: boolean;
  };
  language: string;
}

export interface UserRole {
  id: string;
  name: 'student' | 'moderator' | 'admin';
  permissions: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  profile: Profile;
  preferences?: UserPreferences;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  location?: string;
}

export interface UpdatePreferencesRequest {
  theme?: 'light' | 'dark' | 'system';
  notifications?: Partial<UserPreferences['notifications']>;
  language?: string;
}

export interface PublicUser {
  id: string;
  username: string;
  profile: Pick<Profile, 'firstName' | 'lastName' | 'avatar'>;
}

export type UserSummary = Pick<User, 'id' | 'username' | 'createdAt' | 'updatedAt'> & {
  fullName: string;
};
