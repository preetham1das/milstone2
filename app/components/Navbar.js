import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import React from 'react'

const Navbar = () => {
const router = useRouter();
    const handleLogout = async () => {
        await signOut(auth);
        router.push("/auth");
    };
    return (
        <header className="bg-white shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">AI Feedback Analyzer</h1>
                <button
                    onClick={handleLogout}
                    className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                >
                    Logout
                </button>
            </div>
        </header>
    )
}

export default Navbar