import React, { useState, useEffect, useRef } from 'react';
import { Settings, Camera, RefreshCcw, X, MapPin, Download } from 'lucide-react';
import { format } from 'date-fns';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [showSettings, setShowSettings] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('timestamp_settings');
    return saved ? JSON.parse(saved) : {
      companyName: 'AURA Survey & Inspection',
      surveyorName: 'John Doe',
      surveyCode: 'SRV-2026-09',
      selectedLogo: 'LOGO AFA (1).png'
    };
  });
  
  // Location & Time State
  const [location, setLocation] = useState({ lat: 0, lng: 0, address: 'Mengambil lokasi...', accuracy: 0 });
  const [isLocating, setIsLocating] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Draggable Watermark State
  const [watermarkPos, setWatermarkPos] = useState({ x: 16, y: -1 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  // Logo Object
  const logoImage = useRef(new Image());

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
    
    // Start Camera
    initCamera(facingMode);
    getLocation();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    setWatermarkPos({ x: 16, y: window.innerHeight - 150 });
    
    const handleResize = () => {
      if (watermarkRef.current) {
        clampWatermarkPos(watermarkPos.x, watermarkPos.y);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', handleResize);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update Logo Image Source
  useEffect(() => {
    logoImage.current.src = `/${settings.selectedLogo || 'LOGO AFA (1).png'}`;
  }, [settings.selectedLogo]);

  useEffect(() => {
    if (stream) {
      initCamera(facingMode);
    }
  }, [facingMode]);

  const initCamera = async (mode) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan. Jika diakses via IP, pastikan menggunakan koneksi HTTPS.");
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const getLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy);
          
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await res.json();
            const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setLocation({ lat, lng, address, accuracy });
          } catch (e) {
            setLocation({ lat, lng, address: 'Gagal memuat nama jalan', accuracy });
          }
          setIsLocating(false);
        },
        (error) => {
          console.error(error);
          setLocation({ lat: 0, lng: 0, address: 'Gagal mendapatkan lokasi GPS', accuracy: 0 });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocation({ lat: 0, lng: 0, address: 'GPS tidak didukung', accuracy: 0 });
      setIsLocating(false);
    }
  };

  const saveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('timestamp_settings', JSON.stringify(settings));
    setShowSettings(false);
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("Untuk install di iOS: Tekan tombol 'Share' (ikon panah ke atas) di menu Safari, lalu pilih 'Add to Home Screen'.");
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const clampWatermarkPos = (x, y) => {
    if (!watermarkRef.current) return;
    const rect = watermarkRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    setWatermarkPos({
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    });
  };

  const handlePointerDown = (e) => {
    isDragging.current = true;
    const rect = watermarkRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    clampWatermarkPos(newX, newY);
  };

  const handlePointerUp = (e) => {
    isDragging.current = false;
    e.target.releasePointerCapture(e.pointerId);
  };

  const downloadImage = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas to video resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 1. Draw Original Video Frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Save Original Photo
    const originalFilename = `Survey_${settings.surveyCode}_${format(new Date(), 'yyyyMMdd_HHmmss')}_Original.jpg`;
    const originalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    
    // Calculate scaling factor between window and canvas
    const scaleX = canvas.width / window.innerWidth;
    const scaleY = canvas.height / window.innerHeight;

    const fontSize = Math.floor(canvas.width * 0.02);
    const logoSize = Math.floor(canvas.width * 0.12);
    const paddingX = Math.floor(canvas.width * 0.015);

    // Base coordinates mapped from UI to Canvas
    let drawX = watermarkPos.x * scaleX;
    let drawY = watermarkPos.y * scaleY;

    // Logo coordinates
    const logoX = drawX;
    const logoY = drawY;

    // 2. Add Watermark Layer
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';

    const textX = drawX + logoSize + paddingX;
    let textY = drawY;
    const lineHeight = fontSize * 1.3;

    // Draw Logo
    if (logoImage.current.complete) {
      ctx.drawImage(logoImage.current, logoX, logoY, logoSize, logoSize);
    }

    // Draw Company Name
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillText(settings.companyName, textX, textY);
    textY += lineHeight;

    // Draw other text
    ctx.fillStyle = 'white';
    ctx.font = `${fontSize}px monospace`;
    ctx.fillText(`Surveyor : ${settings.surveyorName}`, textX, textY);
    textY += lineHeight;
    
    ctx.fillText(`Kode     : ${settings.surveyCode}`, textX, textY);
    textY += lineHeight;

    ctx.fillText(`Lokasi   : ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`, textX, textY);
    textY += lineHeight;

    // Wrap address (simple truncation)
    let displayAddress = location.address;
    if (displayAddress.length > 55) displayAddress = displayAddress.substring(0, 52) + '...';
    ctx.fillText(`           ${displayAddress}`, textX, textY);
    textY += lineHeight;

    ctx.fillText(`Akurasi  : ± ${location.accuracy}m`, textX, textY);
    textY += lineHeight;

    const formattedDate = format(currentTime, 'dd MMM yyyy HH:mm:ss');
    ctx.fillText(`Waktu    : ${formattedDate}`, textX, textY);

    // Save Watermark Photo
    const watermarkFilename = `Survey_${settings.surveyCode}_${format(new Date(), 'yyyyMMdd_HHmmss')}_Watermark.jpg`;
    const watermarkDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Trigger both downloads
    downloadImage(originalDataUrl, originalFilename);
    
    // Add small delay to prevent browser blocking multiple downloads
    setTimeout(() => {
      downloadImage(watermarkDataUrl, watermarkFilename);
    }, 500);
  };

  return (
    <div className="app-container">
      {/* Flash Effect */}
      <div className={`flash-overlay ${isFlashing ? 'active' : ''}`}></div>

      {/* Camera View */}
      <video 
        ref={videoRef} 
        className="camera-view" 
        autoPlay 
        playsInline 
        muted 
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* UI Layer */}
      <div className="ui-layer">
        
        <div className="top-bar">
          <button className="icon-btn" onClick={() => setShowSettings(true)}>
            <Settings size={24} />
          </button>
          
          <div className="top-right-group">
            <button className="icon-btn" onClick={getLocation} title="Kalibrasi Lokasi">
              <MapPin size={24} className={isLocating ? 'spinning' : ''} />
            </button>
            
            {(deferredPrompt || isIOS) && (
              <button className="btn-install" onClick={handleInstallClick}>
                <Download size={16} /> Install App
              </button>
            )}
          </div>
        </div>

        {/* Draggable Timestamp Preview */}
        <div 
          ref={watermarkRef}
          className="timestamp-preview"
          style={{
            top: watermarkPos.y === -1 ? 'auto' : watermarkPos.y,
            left: watermarkPos.x,
            bottom: watermarkPos.y === -1 ? '32px' : 'auto'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img src={`/${settings.selectedLogo || 'LOGO AFA (1).png'}`} alt="Logo" className="logo-preview" draggable={false} />
          <div className="timestamp-text-container">
            <span className="accent">{settings.companyName}</span>
            <span>Surveyor : {settings.surveyorName}</span>
            <span>Kode     : {settings.surveyCode}</span>
            <span>Lokasi   : {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
            <span style={{ fontSize: '0.65rem' }}>{location.address}</span>
            <span>Akurasi  : ± {location.accuracy}m</span>
            <span>Waktu    : {format(currentTime, 'dd MMM yyyy HH:mm:ss')}</span>
          </div>
        </div>

        <div className="bottom-bar">
          <div className="shutter-btn" onClick={capturePhoto}>
            <div className="inner-circle"></div>
          </div>
          <button className="icon-btn" style={{ position: 'absolute', right: '1.5rem', bottom: '2.5rem' }} onClick={switchCamera}>
            <RefreshCcw size={24} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Pengaturan Survei</h2>
              <button className="close-btn" onClick={() => setShowSettings(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={saveSettings}>
              <div className="form-group">
                <label>Logo Perusahaan</label>
                <select 
                  value={settings.selectedLogo || 'LOGO AFA (1).png'} 
                  onChange={(e) => setSettings({...settings, selectedLogo: e.target.value})}
                  className="settings-select"
                >
                  <option value="LOGO AFA (1).png">Logo AFA</option>
                  <option value="LOGO LAB.png">Logo LAB</option>
                </select>
              </div>
              <div className="form-group">
                <label>Nama Perusahaan</label>
                <input 
                  type="text" 
                  value={settings.companyName} 
                  onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nama Surveyor</label>
                <input 
                  type="text" 
                  value={settings.surveyorName} 
                  onChange={(e) => setSettings({...settings, surveyorName: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Kode Survei / Sample</label>
                <input 
                  type="text" 
                  value={settings.surveyCode} 
                  onChange={(e) => setSettings({...settings, surveyCode: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">
                Simpan & Tutup
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
