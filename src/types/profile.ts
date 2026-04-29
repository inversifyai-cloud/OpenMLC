export type ProfileSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarMonogram: string;
  avatarAccent: "cyan" | "mint" | "ink";
};

export type AvatarAccent = ProfileSummary["avatarAccent"];
