import React, { useState } from "react";

const AnimationPreview = () => {
  const [mode, setMode] = useState("success"); // "success" | "error"

  const isSuccess = mode === "success";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm bg-white shadow-lg rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold text-gray-800">
            {isSuccess ? "Success State" : "Error State"}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setMode("success")}
              className={`px-2 py-1 text-[11px] rounded ${
                isSuccess
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setMode("error")}
              className={`px-2 py-1 text-[11px] rounded ${
                !isSuccess
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              Error
            </button>
          </div>
        </div>

        {/* Status banner like in AddClientModal */}
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] border ${
            isSuccess
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full ${
              isSuccess ? "bg-emerald-100" : "bg-red-100"
            } ${isSuccess ? "animate-bounce" : "animate-[shake_0.3s_ease-in-out_2]"}`}
          >
            <span className="text-xs">
              {isSuccess ? "✔" : "!"}
            </span>
          </div>
          <p className="leading-snug">
            {isSuccess
              ? "Client profile saved successfully."
              : "Something went wrong while saving the client."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnimationPreview;
