export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee';
  avatar: string;
  created: string;
  updated: string;
}

export interface Contact {
  id: string;
  name: string;
  org: string;
  designation: string;
  city: string;
  country: string;
  email: string;
  mobile: string;
  secondary_email: string;
  secondary_mobile: string;
  how_you_know: string;
  linkedin: string;
  photo: string;
  fu_roles: string[];
  fu_roles_other: string;
  topics: string[];
  topics_other: string;
  added_by: string;
  deleted_at?: string;
  deleted_by?: string;
  expand?: {
    added_by?: User;
    deleted_by?: User;
  };
  created: string;
  updated: string;
}

export interface Activity {
  id: string;
  contact: string;
  activity_type: string;
  event_name: string;
  event_link: string;
  date: string;
  notes: string;
  logged_by: string;
  deleted_at?: string;
  deleted_by?: string;
  expand?: {
    logged_by?: User;
    contact?: Contact;
    deleted_by?: User;
  };
  created: string;
  updated: string;
}
