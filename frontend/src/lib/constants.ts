export const FU_ROLES = [
  { value: 'speaker', label: 'Speaker' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'meetup_host', label: 'Meetup Host' },
  { value: 'foss_club_ambassador_student', label: 'FOSS Club Ambassador (Student)' },
  { value: 'foss_club_ambassador_staff', label: 'FOSS Club Ambassador (Staff)' },
  { value: 'organising_volunteer', label: 'Organising Volunteer' },
  { value: 'gov_board_expert', label: 'Governing Board (Expert)' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'project_maintainer', label: 'Project Maintainer' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

export const TOPICS = [
  { value: 'technologist', label: 'Technologist' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'av_enthusiast', label: 'AV Enthusiast' },
  { value: 'public_policy', label: 'Public Policy' },
  { value: 'ai_ml', label: 'AI / ML' },
  { value: 'government', label: 'Government' },
  { value: 'open_source', label: 'Open Source' },
  { value: 'education', label: 'Education' },
  { value: 'security', label: 'Security' },
  { value: 'devops', label: 'DevOps / Infrastructure' },
  { value: 'design', label: 'Design' },
  { value: 'community', label: 'Community Building' },
  { value: 'research', label: 'Research / Academia' },
  { value: 'legal', label: 'Legal / Policy' },
  { value: 'finance', label: 'Finance / Funding' },
  { value: 'other', label: 'Other' },
];

export const ACTIVITY_TYPES = [
  // Speaking & content
  { value: 'proposed_talk',       label: 'Proposed a Talk' },
  { value: 'spoke_at_event',      label: 'Spoke at Event' },
  { value: 'panel_discussion',    label: 'Participated in Panel Discussion' },
  { value: 'conducted_workshop',  label: 'Conducted a Workshop / Training' },
  { value: 'wrote_content',       label: 'Wrote Article / Blog / Content' },
  // Attending & participation
  { value: 'attended_event',      label: 'Attended Event' },
  { value: 'attended_workshop',   label: 'Attended Workshop / Training' },
  { value: 'participated_hackathon', label: 'Participated in Hackathon' },
  // Organising & community
  { value: 'hosted_meetup',       label: 'Hosted a Meetup' },
  { value: 'established_foss_club', label: 'Established FOSS Club' },
  { value: 'volunteered',         label: 'Volunteered' },
  { value: 'general_volunteer',   label: 'General Volunteer Help' },
  { value: 'mentored_hackathon',  label: 'Mentored at Hackathon' },
  // Open source
  { value: 'contributed_oss',     label: 'Contributed to Open Source' },
  // Funding & grants
  { value: 'sponsored_event',     label: 'Sponsored an Event' },
  { value: 'applied_grant',       label: 'Applied for FOSS Grant' },
  { value: 'received_grant',      label: 'Received FOSS Grant' },
  { value: 'reviewed_grant',      label: 'Reviewed Grant Application' },
  { value: 'judged_project',      label: 'Judged a Project' },
  // Connections & networking
  { value: 'connected_sponsor',   label: 'Connected with Sponsor' },
  { value: 'connected_venue',     label: 'Connected Hosting Venue' },
  { value: 'networking_call',     label: 'Had a Meeting / Call' },
  { value: 'expressed_interest',  label: 'Expressed Interest in Contributing' },
  // Catch-all
  { value: 'other',               label: 'Other Interaction' },
];

// Maps common variants/typos to canonical city names. Applied on blur.
const CITY_NORMALIZATIONS: Record<string, string> = {
  // Delhi NCR
  'new delhi': 'Delhi', 'n. delhi': 'Delhi', 'delhi ncr': 'Delhi NCR',
  'ncr': 'Delhi NCR', 'gurgaon': 'Gurugram', 'greater noida': 'Noida',
  // Karnataka
  'bengaluru': 'Bangalore', 'bangaluru': 'Bangalore', 'bengalore': 'Bangalore',
  'mysore': 'Mysuru', 'mangalore': 'Mangaluru',
  // Maharashtra
  'bombay': 'Mumbai',
  // Tamil Nadu & Pondicherry
  'madras': 'Chennai', 'pondy': 'Puducherry', 'pondicherry': 'Puducherry',
  'trichy': 'Tiruchirappalli', 'tiruchi': 'Tiruchirappalli', 'tuticorin': 'Thoothukudi',
  // Kerala
  'trivandrum': 'Thiruvananthapuram', 'cochin': 'Kochi', 'ernakulam': 'Kochi',
  'calicut': 'Kozhikode', 'trichur': 'Thrissur',
  // West Bengal
  'calcutta': 'Kolkata',
  // UP
  'allahabad': 'Prayagraj', 'benares': 'Varanasi', 'banaras': 'Varanasi', 'kashi': 'Varanasi',
  // Odisha
  'bhubaneshwar': 'Bhubaneswar',
  // Himachal
  'dharamshala': 'Dharamsala',
};

export function normalizeCity(raw: string): string {
  const trimmed = raw.trim();
  return CITY_NORMALIZATIONS[trimmed.toLowerCase()] ?? trimmed;
}

export const CITIES = [
  // Tier 1
  'Ahmedabad', 'Bangalore', 'Chennai', 'Delhi', 'Hyderabad', 'Kolkata', 'Mumbai', 'Pune',

  // Tier 2 — major metros & state capitals
  'Agra', 'Aligarh', 'Allahabad', 'Amritsar', 'Aurangabad', 'Bareilly',
  'Bhopal', 'Bhubaneswar', 'Bikaner', 'Chandigarh', 'Coimbatore', 'Cuttack',
  'Dehradun', 'Dhanbad', 'Faridabad', 'Firozabad', 'Ghaziabad', 'Gorakhpur',
  'Gurugram', 'Guwahati', 'Gwalior', 'Hubli', 'Indore', 'Jabalpur', 'Jaipur',
  'Jalandhar', 'Jamshedpur', 'Jhansi', 'Jodhpur', 'Kanpur', 'Kochi',
  'Kota', 'Lucknow', 'Ludhiana', 'Madurai', 'Mangaluru', 'Meerut',
  'Moradabad', 'Mysuru', 'Nagpur', 'Nashik', 'Noida', 'Patna',
  'Prayagraj', 'Raipur', 'Rajkot', 'Ranchi', 'Saharanpur', 'Solapur',
  'Srinagar', 'Surat', 'Thiruvananthapuram', 'Tiruchirappalli', 'Tiruppur',
  'Udaipur', 'Vadodara', 'Varanasi', 'Vijayawada', 'Visakhapatnam', 'Warangal',

  // Tier 3 — Andhra Pradesh & Telangana
  'Anantapur', 'Bhimavaram', 'Chittoor', 'Eluru', 'Guntur', 'Kakinada',
  'Kadapa', 'Karimnagar', 'Khammam', 'Kurnool', 'Machilipatnam', 'Nalgonda',
  'Nellore', 'Nizamabad', 'Ongole', 'Rajahmundry', 'Srikakulam', 'Suryapet',
  'Tirupati', 'Vizianagaram',

  // Tier 3 — Karnataka
  'Bagalkot', 'Ballari', 'Belagavi', 'Bidar', 'Bijapur', 'Chikmagalur',
  'Chitradurga', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Hospet',
  'Karwar', 'Kolar', 'Madikeri', 'Mandya', 'Raichur', 'Shivamogga',
  'Tumakuru', 'Udupi', 'Vijayapura',

  // Tier 3 — Kerala
  'Alappuzha', 'Kanhangad', 'Kannur', 'Kasaragod', 'Kollam', 'Kozhikode',
  'Malappuram', 'Palakkad', 'Thrissur', 'Thodupuzha',

  // Tier 3 — Tamil Nadu
  'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kanchipuram',
  'Karur', 'Krishnagiri', 'Kumbakonam', 'Nagapattinam', 'Nagercoil',
  'Namakkal', 'Puducherry', 'Ramanathapuram', 'Salem', 'Sivakasi',
  'Thanjavur', 'Thoothukudi', 'Tirunelveli', 'Tiruvannamalai', 'Vellore',
  'Villupuram', 'Virudhunagar',

  // Tier 3 — Maharashtra
  'Akola', 'Amravati', 'Bhilai', 'Bhusawal', 'Chandrapur', 'Dhule',
  'Jalgaon', 'Kolhapur', 'Latur', 'Nanded', 'Nandurbar', 'Osmanabad',
  'Parbhani', 'Sangli', 'Satara', 'Wardha', 'Yavatmal',

  // Tier 3 — Gujarat
  'Anand', 'Bharuch', 'Bhavnagar', 'Bhuj', 'Gandhinagar', 'Jamnagar',
  'Junagadh', 'Mehsana', 'Morbi', 'Navsari', 'Surendranagar', 'Valsad',

  // Tier 3 — Rajasthan
  'Ajmer', 'Alwar', 'Barmer', 'Bharatpur', 'Bhilwara', 'Churu',
  'Hanumangarh', 'Jhunjhunu', 'Nagaur', 'Pali', 'Sikar',
  'Sri Ganganagar', 'Tonk',

  // Tier 3 — Madhya Pradesh
  'Burhanpur', 'Dewas', 'Katni', 'Ratlam', 'Rewa', 'Sagar',
  'Satna', 'Singrauli', 'Ujjain',

  // Tier 3 — Uttar Pradesh
  'Ayodhya', 'Jaunpur', 'Mathura', 'Muzaffarnagar', 'Rae Bareli',
  'Rampur', 'Shahjahanpur', 'Sitapur',

  // Tier 3 — Bihar & Jharkhand
  'Bhagalpur', 'Bokaro', 'Darbhanga', 'Deoghar', 'Gaya',
  'Hazaribagh', 'Muzaffarpur',

  // Tier 3 — West Bengal & Odisha
  'Asansol', 'Balasore', 'Bardhaman', 'Brahmapur', 'Durgapur',
  'Haldia', 'Howrah', 'Jalpaiguri', 'Kharagpur', 'Malda',
  'Puri', 'Rourkela', 'Sambalpur', 'Siliguri',

  // Tier 3 — Punjab & Haryana
  'Ambala', 'Bathinda', 'Hisar', 'Karnal', 'Kurukshetra',
  'Panipat', 'Patiala', 'Rohtak', 'Sonipat', 'Yamunanagar',

  // Tier 3 — Hill states & NE
  'Agartala', 'Aizawl', 'Dharamsala', 'Gangtok', 'Haridwar',
  'Imphal', 'Itanagar', 'Kohima', 'Manali', 'Nainital',
  'Panaji', 'Rishikesh', 'Roorkee', 'Shillong', 'Shimla',

  // International
  'Colombo', 'Dhaka', 'Kathmandu', 'Karachi', 'Lahore',
  'Singapore', 'Kuala Lumpur', 'Dubai', 'Abu Dhabi',
  'London', 'Berlin', 'Amsterdam', 'Paris',
  'Toronto', 'San Francisco', 'New York', 'Seattle',
  'Sydney', 'Melbourne',
];

export const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'Singapore', 'UAE', 'Bangladesh', 'Sri Lanka',
  'Nepal', 'Pakistan', 'Other',
];

// Must stay in sync with the reactions collection's emoji select values.
export const REACTION_EMOJIS = ['👍', '❤️', '🎉', '👏', '💯', '🔥'];
