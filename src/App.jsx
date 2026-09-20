import React, { useState, useEffect, useRef } from 'react';
import { Settings, Camera, RefreshCcw, X, MapPin, Download } from 'lucide-react';
import { format } from 'date-fns';
import './App.css';

// Helper for DMS Coordinates
function toDMS(coordinate, type) {
  const absolute = Math.abs(coordinate);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
  let direction = '';
  if (type === 'lat') {
    direction = coordinate >= 0 ? 'N' : 'S';
  } else {
    direction = coordinate >= 0 ? 'E' : 'W';
  }
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [showSettings, setShowSettings] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  
  // Settings State - Changed key to v2 to force new defaults for existing users
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('timestamp_settings_v2');
    return saved ? JSON.parse(saved) : {
      companyName: 'PT. AFA TOMBUKU PRATAMA',
      surveyorName: 'daus',
      surveyCode: 'SRV-2026-09',
      selectedLogo: 'LOGO AFA (1).png',
      locationName: 'Gedung Pusat'
    };
  });
  
  // Coordinate & Time State
  const [coords, setCoords] = useState({ lat: 0, lng: 0, accuracy: 0 });
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
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
    
    initCamera(facingMode);
    getLocation();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    // Adjusted initial Y to be higher so it doesn't block the shutter button
    setWatermarkPos({ x: 16, y: Math.max(50, window.innerHeight - 380) });
    
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
      alert("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const getLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy);
          
          setCoords({ lat, lng, accuracy });
          setIsLocating(false);
        },
        (error) => {
          console.error(error);
          setCoords({ lat: 0, lng: 0, accuracy: 0 });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setCoords({ lat: 0, lng: 0, accuracy: 0 });
      setIsLocating(false);
    }
  };

  const saveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('timestamp_settings_v2', JSON.stringify(settings));
    setShowSettings(false);
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("Untuk install di iOS: Tekan ikon 'Share' (panah ke atas) di menu Safari bawah, lalu gulir dan pilih 'Add to Home Screen'.");
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Instalasi otomatis tidak didukung saat ini. Anda bisa menginstalnya lewat menu browser (Titik Tiga di pojok kanan atas Chrome) lalu pilih 'Add to Home screen' / 'Install App'.");
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 1. Draw Original Video Frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const originalFilename = `Survey_${settings.surveyCode}_${format(new Date(), 'yyyyMMdd_HHmmss')}_Original.jpg`;
    const originalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    
    const scaleX = canvas.width / window.innerWidth;
    const scaleY = canvas.height / window.innerHeight;

    const fontSize = Math.floor(canvas.width * 0.016);
    const logoSize = Math.floor(canvas.width * 0.08);
    const padding = Math.floor(canvas.width * 0.015);
    const borderRadius = 15;

    let drawX = watermarkPos.x * scaleX;
    let drawY = watermarkPos.y * scaleY;

    // Measure bounding box width and height
    ctx.font = `bold ${fontSize}px monospace`;
    const titleWidth = ctx.measureText(settings.companyName).width;
    ctx.font = `${fontSize}px monospace`;
    const textLines = [
      `Surveyor : ${settings.surveyorName}`,
      `Kode     : ${settings.surveyCode}`,
      `Lokasi   : ${settings.locationName}`,
      `Koordinat: ${toDMS(coords.lat, 'lat')}, ${toDMS(coords.lng, 'lng')}`,
      `Akurasi  : ± ${coords.accuracy}m`,
      `Waktu    : ${format(currentTime, 'dd MMM yyyy HH:mm:ss')}`
    ];
    let maxTextWidth = titleWidth;
    textLines.forEach(t => {
      const w = ctx.measureText(t).width;
      if (w > maxTextWidth) maxTextWidth = w;
    });

    const boxWidth = padding + logoSize + padding + maxTextWidth + padding;
    const boxHeight = padding + (fontSize * 1.4 * 7) + padding;

    // 2. Draw neat watermark background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, boxWidth, boxHeight, borderRadius);
    ctx.fill();

    // 3. Draw Logo
    const logoX = drawX + padding;
    const logoY = drawY + (boxHeight / 2) - (logoSize / 2); // Center logo vertically
    if (logoImage.current.complete) {
      // Draw white background for logo just in case
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.roundRect(logoX, logoY, logoSize, logoSize, 8);
      ctx.fill();
      ctx.drawImage(logoImage.current, logoX, logoY, logoSize, logoSize);
    }

    // 4. Draw Texts
    const textX = logoX + logoSize + padding;
    let textY = drawY + padding;
    const lineHeight = fontSize * 1.4;

    ctx.fillStyle = '#fbbf24'; // Amber accent
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(settings.companyName, textX, textY);
    textY += lineHeight;

    ctx.fillStyle = 'white';
    ctx.font = `${fontSize}px monospace`;
    textLines.forEach(line => {
      ctx.fillText(line, textX, textY);
      textY += lineHeight;
    });

    // Save Watermark Photo
    const watermarkFilename = `Survey_${settings.surveyCode}_${format(new Date(), 'yyyyMMdd_HHmmss')}_Watermark.jpg`;
    const watermarkDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    downloadImage(originalDataUrl, originalFilename);
    setTimeout(() => {
      downloadImage(watermarkDataUrl, watermarkFilename);
    }, 500);
  };

  return (
    <div className="app-container">
      <div className={`flash-overlay ${isFlashing ? 'active' : ''}`}></div>

      <video 
        ref={videoRef} 
        className="camera-view" 
        autoPlay 
        playsInline 
        muted 
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="ui-layer">
        
        <div className="top-bar">
          <button className="icon-btn" onClick={() => setShowSettings(true)}>
            <Settings size={24} />
          </button>
          
          <div className="top-right-group">
            <button className="icon-btn" onClick={getLocation} title="Kalibrasi Lokasi">
              <MapPin size={24} className={isLocating ? 'spinning' : ''} />
            </button>
          </div>
        </div>

        {/* Neat Draggable Timestamp Preview */}
        <div 
          ref={watermarkRef}
          className="timestamp-preview neat-box"
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
          <div className="logo-container">
            <img src={`/${settings.selectedLogo || 'LOGO AFA (1).png'}`} alt="Logo" className="logo-preview" draggable={false} />
          </div>
          <div className="timestamp-text-container">
            <span className="accent">{settings.companyName}</span>
            <span>Surveyor : {settings.surveyorName}</span>
            <span>Kode     : {settings.surveyCode}</span>
            <span>Lokasi   : {settings.locationName}</span>
            <span>Koordinat: {toDMS(coords.lat, 'lat')}, {toDMS(coords.lng, 'lng')}</span>
            <span>Akurasi  : ± {coords.accuracy}m</span>
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

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Pengaturan Survei</h2>
              <button className="close-btn" onClick={() => setShowSettings(false)}>
                <X size={24} />
              </button>
            </div>
            
            {/* Always show the install banner, handle clicks dynamically */}
            <div className="install-banner">
              <div className="install-text">
                <strong>Install Aplikasi</strong>
                <p>Pasang di Home Screen Anda.</p>
              </div>
              <button className="btn-install" onClick={handleInstallClick}>
                <Download size={16} /> Install
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
              <div className="form-group">
                <label>Nama Lokasi (Manual)</label>
                <input 
                  type="text" 
                  value={settings.locationName || ''} 
                  onChange={(e) => setSettings({...settings, locationName: e.target.value})}
                  placeholder="Contoh: Gedung Pusat"
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
