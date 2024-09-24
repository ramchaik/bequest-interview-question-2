import React, { useEffect, useState, useCallback } from "react";
import CryptoJS from "crypto-js";

const API_URL = "http://localhost:8080";

// Example keys, in practice these should be securely generated and stored
const encryptionKey = CryptoJS.enc.Hex.parse(CryptoJS.lib.WordArray.random(32).toString());
const hmacKey = CryptoJS.enc.Hex.parse(CryptoJS.lib.WordArray.random(32).toString());

function App() {
  const [data, setData] = useState<string>("");
  const [encryptedData, setEncryptedData] = useState<string>("");
  const [checksum, setChecksum] = useState<string>("");
  const [isTampered, setIsTampered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const encryptData = (data: string) => {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(data, encryptionKey, { iv: iv }).toString();
    return { iv: iv.toString(), encryptedData: encrypted };
  };

  const decryptData = (encryptedData: string, iv: string) => {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey, {
      iv: CryptoJS.enc.Hex.parse(iv),
    }).toString(CryptoJS.enc.Utf8);
    return decrypted;
  };

  const generateHMAC = useCallback((data: string, checksum: string) => {
    const message = `${data}-${checksum}`;
    return CryptoJS.HmacSHA512(message, hmacKey).toString(CryptoJS.enc.Hex);
  }, []);

  const generateChecksum = useCallback((data: string) => {
    return CryptoJS.SHA512(data).toString(CryptoJS.enc.Hex);
  }, []);

  const getData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL);
      const { data, iv, hmac, checksum } = await response.json();

      const clientHMAC = generateHMAC(data, checksum);

      if (clientHMAC !== hmac) {
        setIsTampered(true);
      } else {
        const decryptedData = decryptData(data, iv);
        setData(decryptedData);
        setChecksum(checksum);
        setEncryptedData(data);
        setIsTampered(false);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setIsTampered(true);
    } finally {
      setLoading(false);
    }
  }, [generateHMAC]);

  const updateData = useCallback(async () => {
    setLoading(true);
    try {
      const { iv, encryptedData } = encryptData(data);
      const newChecksum = generateChecksum(data);
      const clientHMAC = generateHMAC(encryptedData, newChecksum);

      await fetch(API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: encryptedData, iv, checksum: newChecksum, hmac: clientHMAC }),
      });

      await getData();
    } catch (error) {
      console.error("Failed to update data:", error);
    } finally {
      setLoading(false);
    }
  }, [data, generateChecksum, generateHMAC, getData]);

  const recoverData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/recover`);
      const { data, iv, hmac, checksum } = await response.json();

      const clientHMAC = generateHMAC(data, checksum);

      if (clientHMAC === hmac) {
        const decryptedData = decryptData(data, iv);
        setData(decryptedData);
        setChecksum(checksum);
        setEncryptedData(data);
        setIsTampered(false);
      } else {
        alert("Failed to recover valid data.");
      }
    } catch (error) {
      console.error("Failed to recover data:", error);
    } finally {
      setLoading(false);
    }
  }, [generateHMAC]);

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
          disabled={loading}
        >
          Update Data
        </button>
        <button
          style={{ fontSize: "20px" }}
          onClick={recoverData}
          disabled={loading}
        >
          Recover Data
        </button>
      </div>
    </div>
  );
}

export default App;
