"use client";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/Store/useAuthStore";


export default function LoginPage() {
const router = useRouter();
const user = useAuthStore((state) => state.user);
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [error, setError] = useState("");
const [loading, setLoading] = useState(false);
const [isSignUp, setIsSignUp] = useState(false);

useEffect(() => {
  if (user) {
    router.push("/dashboard");
  }
}, [user]);


const handleLogin = async (e) => {
e.preventDefault();
setError("");
setLoading(true);


try {
await signInWithEmailAndPassword(auth, email, password);
} catch (err) {
setError(err.message || "Login failed");
} finally {
setLoading(false);
}
};


const handleSignUp = async (e) => {
e.preventDefault();
setError("");
setLoading(true);


try {
await createUserWithEmailAndPassword(auth, email, password);
} catch (err) {
setError(err.message || "Sign up failed");
} finally {
setLoading(false);
}
};


const handleSubmit = isSignUp ? handleSignUp : handleLogin;


return (
<div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
<div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
<h1 className="text-2xl font-semibold text-center mb-6">
{isSignUp ? "Create your account" : "Sign in to your account"}
</h1>


<form onSubmit={handleSubmit} className="space-y-4">
<input
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
required
/>


<input
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
required
/>


{error && (
<p className="text-sm text-red-600 text-center">{error}</p>
)}


<button
type="submit"
disabled={loading}
className="w-full bg-black text-white py-3 rounded-lg font-medium hover:opacity-90 transition"
>
{loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Sign Up" : "Sign In")}
</button>
</form>


<p className="text-sm text-center text-gray-500 mt-6">
{isSignUp ? "Already have an account? " : "Don't have an account? "}
<span
onClick={() => setIsSignUp(!isSignUp)}
className="underline cursor-pointer font-medium text-black hover:opacity-70"
>
{isSignUp ? "Sign in" : "Sign up"}
</span>
</p>
</div>
</div>
);
}