import type {
  HostApplicationStatus,
  RoomStatus,
  UserRole,
  UserStatus,
  CurrencyType,
  GiftAnimationTier,
} from "./enums.js";

export interface PublicUserSummary {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

export interface UserView {
  id: string;
  email: string;
  username: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  createdAt: string;
}

export interface HostApplicationView {
  id: string;
  userId: string;
  legalName: string;
  displayName: string;
  countryCode: string;
  status: HostApplicationStatus;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RoomView {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  category: string | null;
  status: RoomStatus;
  chatEnabled: boolean;
  giftEnabled: boolean;
  playbackUrl: string | null;
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageView {
  id: string;
  roomId: string;
  clientMessageId: string | null;
  sender: PublicUserSummary;
  message: string;
  createdAt: string;
}

export interface WalletView {
  currencyType: CurrencyType;
  balanceAvailable: number;
  balanceLocked: number;
}

export interface GiftCatalogItemView {
  id: string;
  code: string;
  name: string;
  coinPrice: number;
  diamondReward: number;
  animationTier: GiftAnimationTier;
  iconUrl: string | null;
  active: boolean;
}

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion: number;
}
