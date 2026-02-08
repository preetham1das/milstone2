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
} from "firebase/firestore";
import { analyzeText, analyzeFile, extractCSVData } from "@/lib/gemini";

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

  if (!user) {
    redirect("/auth");
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  // Fetch past analysis records
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
      } finally {
        setPastAnalysisLoading(false);
      }
    };

    fetchAnalysisRecords();
  }, [user.email]);

  // Handle text analysis
  const handleAnalyzeText = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) {
      setAnalysisMessage("Please enter some text to analyze");
      return;
    }

    setLoading(true);
    setAnalysisMessage("Analyzing your text...");

    try {
      const result = await analyzeText(textInput);

      // Save to Firestore
      await addDoc(collection(db, "analysisRecords"), {
        userEmail: user.email,
        content: textInput,
        analysis: result.analysis,
        timestamp: new Date(),
        type: "text",
      });

      setAnalysisMessage("Analysis saved successfully!");
      setTextInput("");

      // Refresh analysis records
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
      setAnalysisMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle file analysis
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

      const result = await analyzeFile(fileContent, fileName);

      // If CSV, also extract and store the data
      let csvData = null;
      if (fileName.toLowerCase().endsWith(".csv")) {
        csvData = await extractCSVData(fileContent);
      }

      // Save to Firestore
      await addDoc(collection(db, "analysisRecords"), {
        userEmail: user.email,
        fileName: fileName,
        fileContent: fileContent,
        csvData: csvData,
        analysis: result.analysis,
        timestamp: new Date(),
        type: "file",
      });

      setAnalysisMessage("File analysis saved successfully!");
      setFileInput(null);

      // Refresh analysis records
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
      setAnalysisMessage(`Error: ${error.message}`);
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

        {/* Profile Tab */}
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

        {/* Analyze Tab */}
        {activeTab === "analyze" && (
          <div className="space-y-6">
            {/* Text Analysis Section */}
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
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 transition"
                >
                  {loading ? "Analyzing..." : "Analyze Comments"}
                </button>
              </form>
            </div>

            {/* File Upload Section */}
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
                    disabled={loading}
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
                  disabled={loading || !fileInput}
                  className="mt-4 w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 transition"
                >
                  {loading ? "Analyzing..." : "Analyze File"}
                </button>
              </form>
            </div>

            {/* Analysis Message */}
            {analysisMessage && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg">
                {analysisMessage}
              </div>
            )}
          </div>
        )}

        {/* Past Records Tab */}
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
              <div className="space-y-4">
                {analysisRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {record.type === "file"
                            ? record.fileName
                            : "Text Analysis"}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {record.type === "file" ? "File" : "Text"} Analysis •{" "}
                          {new Date(record.timestamp?.toDate?.()).toLocaleString()}
                        </p>
                      </div>
                      <span className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                        {record.type}
                      </span>
                    </div>

                    {record.csvData && (
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          CSV Data Preview:
                        </p>
                        <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto text-xs">
                          <pre className="font-mono text-gray-600">
                            {JSON.stringify(record.csvData.slice(0, 3), null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        AI Analysis:
                      </p>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap line-clamp-4">
                        {record.analysis}
                      </p>
                    </div>

                    {record.type === "text" && (
                      <div className="mt-3 bg-gray-50 p-4 rounded">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Original Content:
                        </p>
                        <p className="text-gray-700 text-sm line-clamp-3">
                          {record.content}
                        </p>
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