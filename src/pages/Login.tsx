import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isOtpLogin, setIsOtpLogin] = useState(false);
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  
  const login = useMutation(api.auth.login);
  const loginWithOtp = useMutation(api.auth.loginWithOtp);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      if (isOtpLogin && !showOtpInput) {
        // Request OTP
        const res = await login({ identifier });
        if (res.requireOtp) {
          setShowOtpInput(true);
          toast.success("OTP sent to your email");
        }
      } else if (isOtpLogin && showOtpInput) {
        // Verify OTP
        const res = await loginWithOtp({ email: identifier, otp });
        if (res.success) {
          toast.success("Logged in successfully");
          navigate("/dashboard");
        }
      } else {
        // Password Login
        const res = await login({ identifier, password });
        if (res.success) {
          toast.success("Logged in successfully");
          navigate("/dashboard");
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <Card className="w-[400px] bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Vicovibe Coder Login
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Email or Username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          
          {!isOtpLogin && (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          )}

          {showOtpInput && (
            <div className="space-y-2">
              <Input
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          )}

          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700" 
            onClick={handleLogin}
          >
            {showOtpInput ? "Verify OTP" : (isOtpLogin ? "Get OTP" : "Login")}
          </Button>

          <div className="flex justify-between text-sm text-gray-400">
            <button onClick={() => { setIsOtpLogin(!isOtpLogin); setShowOtpInput(false); }}>
              {isOtpLogin ? "Use Password" : "Login with OTP"}
            </button>
            <button onClick={() => navigate("/signup")}>
              Create Account
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}