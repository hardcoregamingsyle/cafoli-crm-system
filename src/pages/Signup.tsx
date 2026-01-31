import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"details" | "otp">("details");

  const signup = useMutation(api.auth.signup);
  const verifyEmail = useMutation(api.auth.verifyEmail);
  const navigate = useNavigate();

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await signup({ email, username, password });
      setStep("otp");
      toast.success("Account created. Please check email for OTP.");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleVerify = async () => {
    try {
      await verifyEmail({ email, otp });
      toast.success("Email verified! Please login.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <Card className="w-[400px] bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Join Vicovibe Coder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "details" ? (
            <>
              <Input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                onClick={handleSignup}
              >
                Sign Up
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400 text-center">
                Enter the OTP sent to {email}
              </p>
              <Input
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Button 
                className="w-full bg-green-600 hover:bg-green-700" 
                onClick={handleVerify}
              >
                Verify Email
              </Button>
            </>
          )}
          
          <div className="text-center text-sm text-gray-400">
            <button onClick={() => navigate("/login")}>
              Already have an account? Login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
