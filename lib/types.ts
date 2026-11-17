export type Viewer = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
};

export type ActionState = {
  success: boolean;
  message: string;
};
