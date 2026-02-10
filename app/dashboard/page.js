"use client";

import { useAuthStore } from "@/Store/useAuthStore";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { extractCSVData } from "@/lib/csv";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("analyze");
  const [analysisRecords, setAnalysisRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pastAnalysisLoading, setPastAnalysisLoading] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [fileInput, setFileInput] = useState(null);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [rateLimitUntil, setRateLimitUntil] = useState(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
  const [initError, setInitError] = useState(null);

  if (!user) {
    redirect("/auth");
  }

  
  const formatFirebaseError = (error) => {
    const code = error?.code || "";
    const message = error?.message || error?.toString?.() || "Unknown error";

    if (code === "permission-denied") {
      return "Permission denied. Please ensure Firestore security rules are configured. See FIRESTORE_RULES.md for setup instructions.";
    }
    if (code === "unavailable") {
      return "Firestore is temporarily unavailable. Please try again.";
    }
    return message;
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

 
  useEffect(() => {
    const fetchAnalysisRecords = async () => {
      try {
        const recordsRef = collection(db, "analysisRecords");
        const q = query(
          recordsRef,
          where("userEmail", "==", user.email),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAnalysisRecords(records);
      } catch (error) {
        console.error("Error fetching analysis records:", error);
        if (error?.code === "permission-denied") {
          setInitError(formatFirebaseError(error));
        }
      } finally {
        setPastAnalysisLoading(false);
      }
    };

    fetchAnalysisRecords();
  }, [user.email]);

  useEffect(() => {
    if (!rateLimitUntil) return;
    const interval = setInterval(() => {
      const remainingMs = rateLimitUntil - Date.now();
      if (remainingMs <= 0) {
        setRateLimitRemaining(0);
        setRateLimitUntil(null);
        setAnalysisMessage("");
        clearInterval(interval);
      } else {
        setRateLimitRemaining(Math.ceil(remainingMs / 1000));
        setAnalysisMessage(`Rate limit exceeded. Try again in ${Math.ceil(remainingMs / 1000)}s.`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitUntil]);

 
  const handleAnalyzeText = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) {
      setAnalysisMessage("Please enter some text to analyze");
      return;
    }

    setLoading(true);
     
      let docRef = null;
      try {
        setAnalysisMessage("Saving input...");
        docRef = await addDoc(collection(db, "analysisRecords"), {
          userEmail: user.email,
          content: textInput,
          analysis: "Pending",
          timestamp: serverTimestamp(),
          type: "text",
        });
      } catch (saveError) {
        console.error("Error saving initial record:", saveError);
        setLoading(false);
        setAnalysisMessage(formatFirebaseError(saveError));
        return;
      }

      
      try {
        setAnalysisMessage("Analyzing your text...");
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", text: textInput }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Analysis failed");
        }

        const result = await response.json();

        if (docRef) {
          try {
            await updateDoc(docRef, {
              analysis: result.analysis,
              completedAt: serverTimestamp(),
            });
          } catch (updErr) {
            console.error("Failed to update record with analysis:", updErr);
          }
        }

        setAnalysisMessage("Analysis saved successfully!");
        setTextInput("");

        
        const recordsRef = collection(db, "analysisRecords");
        const q = query(
          recordsRef,
          where("userEmail", "==", user.email),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAnalysisRecords(records);

        setTimeout(() => setAnalysisMessage(""), 3000);
      } catch (error) {
        console.error("Error during analysis:", error);

        
        if (docRef) {
          try {
            await updateDoc(docRef, {
              analysis: `Error: ${error?.message || String(error)}`,
              completedAt: serverTimestamp(),
            });
          } catch (updErr) {
            console.error("Failed to update record after error:", updErr);
          }
        }

        if (error?.retryAfter) {
          const secs = Math.ceil(error.retryAfter);
          const until = Date.now() + secs * 1000;
          setRateLimitUntil(until);
          setRateLimitRemaining(secs);
          setAnalysisMessage(`Rate limit exceeded. Try again in ${secs}s.`);
        } else if (error?.code === "permission-denied") {
          setAnalysisMessage(formatFirebaseError(error));
        } else if (error?.code === "unavailable") {
          setAnalysisMessage("Analysis service is temporarily unavailable. Please try again.");
        } else {
          const errMsg = error?.message || error?.toString?.() || "Unknown error occurred";
          setAnalysisMessage(`Error: ${errMsg}`);
        }
      } finally {
        setLoading(false);
      }
  };


  const handleAnalyzeFile = async (e) => {
    e.preventDefault();
    if (!fileInput) {
      setAnalysisMessage("Please select a file to analyze");
      return;
    }

    setLoading(true);
    setAnalysisMessage("Analyzing your file...");

    try {
      const fileContent = await fileInput.text();
      const fileName = fileInput.name;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "file",
          fileContent,
          fileName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Analysis failed");
      }

      const result = await response.json();

      
      let csvData = null;
      if (fileName.toLowerCase().endsWith(".csv")) {
        csvData = await extractCSVData(fileContent);
      }

     
      await addDoc(collection(db, "analysisRecords"), {
        userEmail: user.email,
        fileName: fileName,
        fileContent: fileContent,
        csvData: csvData,
        analysis: result.analysis,
        timestamp: serverTimestamp(),
        type: "file",
      });

      setAnalysisMessage("File analysis saved successfully!");
      setFileInput(null);

      
      const recordsRef = collection(db, "analysisRecords");
      const q = query(
        recordsRef,
        where("userEmail", "==", user.email),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAnalysisRecords(records);

      setTimeout(() => setAnalysisMessage(""), 3000);
    } catch (error) {
      console.error("Error caught:", error);
      console.error("Error type:", typeof error);
      console.error("Error keys:", Object.keys(error || {}));
      console.error("Error toString:", error?.toString?.());
      
      if (error?.retryAfter) {
        const secs = Math.ceil(error.retryAfter);
        const until = Date.now() + secs * 1000;
        setRateLimitUntil(until);
        setRateLimitRemaining(secs);
        setAnalysisMessage(`Rate limit exceeded. Try again in ${secs}s.`);
      } else if (error?.code === "permission-denied") {
        setAnalysisMessage(formatFirebaseError(error));
      } else if (error?.code === "unavailable") {
        setAnalysisMessage("Firestore is temporarily unavailable. Please try again.");
      } else {
        const errMsg = error?.message || error?.toString?.() || "Unknown error occurred";
        setAnalysisMessage(`Error: ${errMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "profile"
                ? "border-black text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("analyze")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "analyze"
                ? "border-black text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Analyze
          </button>
          <button
            onClick={() => setActiveTab("records")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "records"
                ? "border-black text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Past Records
          </button>
        </div>

        
        {initError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
            <p className="font-semibold"> Setup Required</p>
            <p className="text-sm mt-2">{initError}</p>
          </div>
        )}

        
        {activeTab === "profile" && (
          <div className="bg-white p-8 rounded-2xl shadow">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">
              User Profile
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {user.displayName || "User"}
                  </h3>
                  <p className="text-gray-700 font-medium">{user.email}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Member since{" "}
                    {new Date(user.metadata?.creationTime).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        
        {activeTab === "analyze" && (
          <div className="space-y-6">
          
            <div className="bg-white p-8 rounded-2xl shadow">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                Paste Comments
              </h2>
              <form onSubmit={handleAnalyzeText}>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste or type your feedback/comments here..."
                  className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  disabled={loading || rateLimitRemaining > 0}
                />
                <button
                  type="submit"
                  disabled={loading || rateLimitRemaining > 0}
                  className="mt-4 w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 transition"
                >
                  {loading ? "Analyzing..." : rateLimitRemaining > 0 ? `Rate limited (${rateLimitRemaining}s)` : "Analyze Comments"}
                </button>
              </form>
            </div>

         
            <div className="bg-white p-8 rounded-2xl shadow">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                Upload File
              </h2>
              <form onSubmit={handleAnalyzeFile}>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-black transition">
                  <input
                    type="file"
                    accept=".csv,.pdf,.txt"
                    onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                    disabled={loading || rateLimitRemaining > 0}
                    className="hidden"
                    id="fileInput"
                  />
                  <label htmlFor="fileInput" className="cursor-pointer block">
                    <p className="text-gray-700 font-medium">
                      {fileInput
                        ? `Selected: ${fileInput.name}`
                        : "Click to upload or drag CSV, PDF, or TXT file"}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      Max file size: 25MB
                    </p>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading || !fileInput || rateLimitRemaining > 0}
                  className="mt-4 w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 transition"
                >
                  {loading ? "Analyzing..." : rateLimitRemaining > 0 ? `Rate limited (${rateLimitRemaining}s)` : "Analyze File"}
                </button>
              </form>
            </div>

            
            {analysisMessage && (
              <div className={`border-l-4 p-5 rounded-lg font-medium transition-all ${
                analysisMessage.includes("Error") || analysisMessage.includes("Rate limit")
                  ? "bg-red-50 border-l-red-500 text-red-800"
                  : analysisMessage.includes("saved successfully")
                  ? "bg-green-50 border-l-green-500 text-green-800"
                  : "bg-blue-50 border-l-blue-500 text-blue-800"
              }`}>
                {analysisMessage.includes("Error") || analysisMessage.includes("Rate limit") ? "⚠️ " : "✓ "}
                {analysisMessage}
              </div>
            )}
          </div>
        )}

        
        {activeTab === "records" && (
          <div className="bg-white p-8 rounded-2xl shadow">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">
              Past Analysis Records
            </h2>

            {pastAnalysisLoading ? (
              <p className="text-gray-600">Loading records...</p>
            ) : analysisRecords.length === 0 ? (
              <p className="text-gray-600 font-medium">
                No analysis records yet. Start by analyzing some feedback or
                files!
              </p>
            ) : (
              <div className="space-y-6">
                {analysisRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border border-gray-300 rounded-xl p-6 hover:shadow-lg transition bg-gradient-to-br from-white to-gray-50"
                  >
                   
                    <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">
                          {record.type === "file"
                            ? `  ${record.fileName}`
                            : "  Text Analysis"}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {record.type === "file" ? "File" : "Text"} Analysis • {" "}
                          {new Date(record.timestamp?.toDate?.()).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide ${
                        record.type === "file" 
                          ? "bg-blue-100 text-blue-800" 
                          : "bg-purple-100 text-purple-800"
                      }`}>
                        {record.type}
                      </span>
                    </div>

                   
                    {record.csvData && (
                      <div className="mb-5">
                        <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">
                           CSV Data Summary
                        </p>
                        <div className="bg-white border border-gray-200 p-4 rounded-lg max-h-48 overflow-y-auto">
                          <div className="text-xs space-y-2">
                            {record.csvData.slice(0, 3).map((row, idx) => (
                              <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
                                <pre className="font-mono text-gray-700 whitespace-pre-wrap break-words">
                                  {JSON.stringify(row, null, 2)}
                                </pre>
                              </div>
                            ))}
                            {record.csvData.length > 3 && (
                              <p className="text-gray-600 italic pt-2">
                                ... and {record.csvData.length - 3} more rows
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                   
                    <div className="mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5 rounded-lg">
                      <p className="text-xs font-bold text-indigo-900 mb-3 uppercase tracking-wide">
                         AI Analysis & Insights
                      </p>
                      <div className="prose prose-sm max-w-none">
                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words font-normal">
                          {record.analysis}
                        </div>
                      </div>
                    </div>

                    
                    {record.type === "text" && (
                      <div className="bg-gray-100 border border-gray-300 p-5 rounded-lg">
                        <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">
                           Original Content
                        </p>
                        <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
                          {record.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
