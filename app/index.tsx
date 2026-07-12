import { Redirect } from "expo-router";
import { SessionBootstrapScreen } from "../src/features/auth/screens/SessionBootstrapScreen";
import { useAuthStore } from "../src/store/auth-store";

export default function IndexRoute() {
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isSignedIn = useAuthStore((state) => state.isSignedIn);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);

  if (isBootstrapping || bootstrapError) return <SessionBootstrapScreen />;

  return <Redirect href={isSignedIn ? "/(app)/(tabs)/home" : "/(auth)/welcome"} />;
}
