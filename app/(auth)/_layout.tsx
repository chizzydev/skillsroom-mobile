import { Redirect, Stack } from "expo-router";
import { SessionBootstrapScreen } from "../../src/features/auth/screens/SessionBootstrapScreen";
import { useAuthStore } from "../../src/store/auth-store";

export default function AuthLayout() {
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isSignedIn = useAuthStore((state) => state.isSignedIn);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);

  if (isBootstrapping || bootstrapError) return <SessionBootstrapScreen />;

  if (isSignedIn) return <Redirect href="/(app)/(tabs)/home" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
