export type RegisterType = "register";
export type ReferralType = "referral";
export type AddFriendType = "addfriend";
export type UnfriendType = "unfriend";

export interface RegisterEvent {
  type: RegisterType;
  name: string;
  created_at: string;
}

export interface ReferralEvent {
  type: ReferralType;
  referredBy: string;
  user: string;
  created_at: string;
}

export interface AddFriendEvent {
  type: AddFriendType;
  user1_name: string;
  user2_name: string;
  created_at: string;
}

export interface UnfriendEvent {
  type: UnfriendType;
  user1_name: string;
  user2_name: string;
  created_at: string;
}

export type ConnectionEvent =
  | RegisterEvent
  | ReferralEvent
  | AddFriendEvent
  | UnfriendEvent;
