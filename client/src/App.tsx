import React, { useEffect, useState, useCallback } from "react";
import hmacSHA512 from "crypto-js/hmac-sha512";
import encHex from "crypto-js/enc-hex";
import sha512 from "crypto-js/sha512";

const API_URL = "http://localhost:8080";

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [data, setData] = useState<string>("");
  const [checksum, setChecksum] = useState<string>("");
  const [isTampered, setIsTampered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const initializeClient = async () => {
      const response = await fetch(`${API_URL}/init`, { method: "POST" });
      const { token, secret } = await response.json();
      setToken(token);
      setSecret(secret);
    };

    initializeClient();
  }, []);

  const generateHMAC = useCallback((data: string, checksum: string, secret: string) => {
    const message = `${data}-${checksum}`;
    return hmacSHA512(message, secret).toString(encHex);
  }, []);

  const generateChecksum = useCallback((data: string) => {
    return sha512(data).toString(encHex);
  }, []);

  const getData = useCallback(async () => {
    if (!token || !secret) return;
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        headers: { "x-client-token": token },
      });
      const { data, hmac, checksum, isValid } = await response.json();

      const clientHMAC = generateHMAC(data, checksum, secret);

      if (!isValid || clientHMAC !== hmac) {
        setIsTampered(true);
      } else {
        setData(data);
        setChecksum(checksum);
        setIsTampered(false);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setIsTampered(true);
    } finally {
      setLoading(false);
    }
  }, [generateHMAC, token, secret]);

  const updateData = useCallback(async () => {
    if (!token || !secret) return;
    setLoading(true);
    try {
      const newChecksum = generateChecksum(data);
      const clientHMAC = generateHMAC(data, newChecksum, secret);
      
      await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-client-token": token,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data, checksum: newChecksum, hmac: clientHMAC }),
      });

      await getData();
    } catch (error) {
      console.error("Failed to update data:", error);
    } finally {
      setLoading(false);
    }
  }, [data, generateChecksum, generateHMAC, getData, token, secret]);

  const recoverData = useCallback(async () => {
    if (!token || !secret) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/recover`, {
        headers: { "x-client-token": token },
      });
      const { data, hmac, checksum, isValid } = await response.json();

      const clientHMAC = generateHMAC(data, checksum, secret);

      if (isValid && clientHMAC === hmac) {
        setData(data);
        setChecksum(checksum);
        setIsTampered(false);
      } else {
        alert("Failed to recover valid data.");
      }
    } catch (error) {
      console.error("Failed to recover data:", error);
    } finally {
      setLoading(false);
    }
  }, [generateHMAC, token, secret]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        position: "absolute",
        padding: 0,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: "20px",
        fontSize: "30px",
      }}
    >
      <div>
        {loading
          ? "Loading..."
          : `Saved Data ${isTampered ? " - Tampered!" : ""}`}
      </div>
      <input
        style={{ fontSize: "30px" }}
        type="text"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          style={{ fontSize: "20px" }}
          onClick={updateData}
          disabled={loading || !token || !secret}
        >
          Update Data
        </button>
        <button
          style={{ fontSize: "20px" }}
          onClick={recoverData}
          disabled={loading || !token || !secret}
        >
          Recover Data
        </button>
      </div>
    </div>
  );
}

export default App;
