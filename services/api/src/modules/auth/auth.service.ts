import { compare, hash } from "bcryptjs";
import { prisma } from "@social-livestream/db";
import { assertAllowedToLogin, DomainError } from "@social-livestream/domain-core";
import { signAccessToken } from "../../common/auth.js";
import { serializeUser } from "../../common/serialization.js";

async function ensureWalletsAndPreferences(userId: string): Promise<void> {
  await prisma.wallet.upsert({
    where: {
      userId_currencyType: {
        userId,
        currencyType: "COIN",
      },
    },
    update: {},
    create: {
      userId,
      currencyType: "COIN",
      balanceAvailable: 0,
    },
  });

  await prisma.wallet.upsert({
    where: {
      userId_currencyType: {
        userId,
        currencyType: "DIAMOND",
      },
    },
    update: {},
    create: {
      userId,
      currencyType: "DIAMOND",
      balanceAvailable: 0,
    },
  });

  await prisma.notificationPreference.upsert({
    where: {
      userId,
    },
    update: {},
    create: {
      userId,
    },
  });
}

export async function register(input: { email: string; password: string; username: string }) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email.toLowerCase() }, { username: input.username }],
    },
  });

  if (existingUser) {
    throw new DomainError("VALIDATION_ERROR", 409, "Email or username already exists.");
  }

  const passwordHash = await hash(input.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        username: input.username,
      },
    });

    await tx.wallet.createMany({
      data: [
        {
          userId: createdUser.id,
          currencyType: "COIN",
          balanceAvailable: 0,
        },
        {
          userId: createdUser.id,
          currencyType: "DIAMOND",
          balanceAvailable: 0,
        },
      ],
    });

    await tx.notificationPreference.create({
      data: {
        userId: createdUser.id,
      },
    });

    return createdUser;
  });

  return {
    user: serializeUser(user),
    accessToken: signAccessToken({
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    }),
  };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email.toLowerCase(),
    },
  });

  if (!user) {
    throw new DomainError("UNAUTHORIZED", 401, "Invalid email or password.");
  }

  const passwordMatch = await compare(input.password, user.passwordHash);

  if (!passwordMatch) {
    throw new DomainError("UNAUTHORIZED", 401, "Invalid email or password.");
  }

  assertAllowedToLogin(user.status);

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await ensureWalletsAndPreferences(updatedUser.id);

  return {
    user: serializeUser(updatedUser),
    accessToken: signAccessToken({
      userId: updatedUser.id,
      role: updatedUser.role,
      tokenVersion: updatedUser.tokenVersion,
    }),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new DomainError("UNAUTHORIZED", 401, "Session user not found.");
  }

  return serializeUser(user);
}

export async function getAccountSettings(userId: string) {
  await ensureWalletsAndPreferences(userId);

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      notificationPreference: true,
    },
  });

  if (!user || !user.notificationPreference) {
    throw new DomainError("UNAUTHORIZED", 401, "Session user not found.");
  }

  return {
    profile: serializeSettingsProfile(user),
    notifications: serializeNotificationPreferences(user.notificationPreference),
  };
}

export async function updateProfile(
  userId: string,
  input: {
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    countryCode: string | null;
  },
) {
  const normalizedUsername = input.username.trim();
  const normalizedAvatarUrl = input.avatarUrl?.trim() ? input.avatarUrl.trim() : null;
  const normalizedBio = input.bio?.trim() ? input.bio.trim() : null;
  const normalizedCountryCode = input.countryCode?.trim() ? input.countryCode.trim().toUpperCase() : null;

  const conflictingUser = await prisma.user.findFirst({
    where: {
      username: normalizedUsername,
      NOT: {
        id: userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (conflictingUser) {
    throw new DomainError("VALIDATION_ERROR", 409, "Username already exists.");
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      username: normalizedUsername,
      avatarUrl: normalizedAvatarUrl,
      bio: normalizedBio,
      countryCode: normalizedCountryCode,
    },
  });

  return serializeSettingsProfile(updatedUser);
}

export async function updateNotificationPreferences(
  userId: string,
  input: {
    hostLive: boolean;
    paymentSuccess: boolean;
    withdrawalStatus: boolean;
    moderationAlerts: boolean;
    preferredChannel: "PUSH" | "EMAIL" | "IN_APP";
  },
) {
  const preferences = await prisma.notificationPreference.upsert({
    where: {
      userId,
    },
    update: {
      hostLive: input.hostLive,
      paymentSuccess: input.paymentSuccess,
      withdrawalStatus: input.withdrawalStatus,
      moderationAlerts: input.moderationAlerts,
      preferredChannel: input.preferredChannel,
    },
    create: {
      userId,
      hostLive: input.hostLive,
      paymentSuccess: input.paymentSuccess,
      withdrawalStatus: input.withdrawalStatus,
      moderationAlerts: input.moderationAlerts,
      preferredChannel: input.preferredChannel,
    },
  });

  return serializeNotificationPreferences(preferences);
}

export async function changePassword(
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
  },
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new DomainError("UNAUTHORIZED", 401, "Session user not found.");
  }

  const passwordMatch = await compare(input.currentPassword, user.passwordHash);

  if (!passwordMatch) {
    throw new DomainError("UNAUTHORIZED", 401, "Current password is incorrect.");
  }

  if (input.currentPassword === input.newPassword) {
    throw new DomainError("VALIDATION_ERROR", 400, "New password must be different from current password.");
  }

  const passwordHash = await hash(input.newPassword, 12);

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      passwordHash,
      tokenVersion: {
        increment: 1,
      },
    },
  });

  return {
    user: serializeUser(updatedUser),
    accessToken: signAccessToken({
      userId: updatedUser.id,
      role: updatedUser.role,
      tokenVersion: updatedUser.tokenVersion,
    }),
  };
}

export async function logout(userId: string) {
  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      tokenVersion: {
        increment: 1,
      },
    },
  });
}

function serializeSettingsProfile(user: {
  id: string;
  email: string;
  username: string | null;
  role: "VIEWER" | "HOST" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  avatarUrl: string | null;
  bio: string | null;
  countryCode: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    countryCode: user.countryCode,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

function serializeNotificationPreferences(preference: {
  hostLive: boolean;
  paymentSuccess: boolean;
  withdrawalStatus: boolean;
  moderationAlerts: boolean;
  preferredChannel: "PUSH" | "EMAIL" | "IN_APP";
}) {
  return {
    hostLive: preference.hostLive,
    paymentSuccess: preference.paymentSuccess,
    withdrawalStatus: preference.withdrawalStatus,
    moderationAlerts: preference.moderationAlerts,
    preferredChannel: preference.preferredChannel,
  };
}
