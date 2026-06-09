import React, { useState, useRef, useEffect } from "react";
import { 
  FileVideo, 
  Send, 
  HelpCircle, 
  Upload, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Clock, 
  Play, 
  Pause, 
  MessageSquare, 
  ChevronRight, 
  Settings, 
  ShieldAlert,
  Sliders,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Message } from "./types";

const SAMPLES = [
  {
    id: "anhai",
    name: "Mascot Anh Hải (Chính thức)",
    url: "/video/anhai.mp4",
    description: "Nhân vật đại diện ảo chính thức được cài đặt riêng cho cổng hỗ trợ."
  },
  {
    id: "male",
    name: "Mascot Nam Công Chức (Mixkit)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-man-holding-a-digital-tablet-and-talking-40502-large.mp4",
    description: "Nhân viên nam cầm bảng tính và diễn thuyết thoải mái."
  },
  {
    id: "female",
    name: "Mascot Nữ Công Chức (Mixkit)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-woman-in-office-talking-to-camera-40019-large.mp4",
    description: "Nhân viên nữ mỉm cười và chào hỏi thân thiện."
  },
  {
    id: "robot",
    name: "Robot Trợ Lý Thảo Luận (Mixkit)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-speaking-robot-41372-large.mp4",
    description: "Hoạt họa robot 3D có cử chỉ nói và nhấp nháy."
  }
];

const SUGGESTIONS = [
  "Thủ tục cấp Căn cước công dân gắn chíp bao gồm những gì?",
  "Tôi muốn đăng ký kết hôn trực tuyến thì làm thế nào?",
  "Làm sao đăng ký tạm trú cho người thuê nhà qua mạng?",
  "Hồ sơ rút Bảo hiểm xã hội một lần cần giấy tờ gì?"
];

export default function App() {
  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: "Xin chào quý công dân! Tôi là Trợ lý Hành chính Công trực tuyến. Tôi có thể hỗ trợ quý công dân giải đáp và thực hiện các thủ tục hành chính, dịch vụ công trực tuyến nhanh chóng. Hãy gửi câu hỏi cho tôi bên dưới!",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Video Source States
  const [videoSource, setVideoSource] = useState(SAMPLES[0].url);
  const [videoSourceName, setVideoSourceName] = useState(SAMPLES[0].name);
  const [isCustomVideo, setIsCustomVideo] = useState(false);

  // Precision Loop Engine States
  const [isIdle, setIsIdle] = useState(true);
  const [idleStart, setIdleStart] = useState(1.0);
  const [idleEnd, setIdleEnd] = useState(2.0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // Audio / Speech Engine States
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [speechSynthesisAvailable, setSpeechSynthesisAvailable] = useState(false);

  // UI Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Check speech synthesis availability
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      setSpeechSynthesisAvailable(true);
    }
  }, []);

  // Sync scroll on chat update (only scroll inside the container to avoid scrolling the whole page)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isLoading]);

  // PRECISION LOOP CONTROLLER: Uses requestAnimationFrame for absolute frame-perfect looping
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animationFrameId: number;

    const tick = () => {
      if (video) {
        const currentTime = video.currentTime;
        setPlaybackTime(currentTime);

        if (isIdle) {
          // If in Idle Mode, trap the playhead strictly inside [idleStart, idleEnd]
          if (currentTime >= idleEnd || currentTime < idleStart) {
            video.currentTime = idleStart;
            if (video.paused && isPlaying) {
              video.play().catch(() => {});
            }
          }
        } else {
          // If in Active state (answering queries), let the whole video play on loop.
          // Fallback check to ensure regular looping if it hits the end
          if (video.ended || currentTime >= video.duration - 0.1) {
            video.currentTime = 0;
            if (video.paused && isPlaying) {
              video.play().catch(() => {});
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isIdle, idleStart, idleEnd, isPlaying]);

  // Re-sync video play triggers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, videoSource]);

  // Speech helper: Speak response using Web Speech Synthesis
  const speakText = (text: string) => {
    if (!speechSynthesisAvailable || !isTtsEnabled) return;

    // Cancel active speakings
    window.speechSynthesis.cancel();

    // Clean markdown before speaking
    const cleanText = text
      .replace(/[\#\*\-\>\_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Attempt to locate a Vietnamese voice
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(voice => voice.lang.includes("vi") || voice.lang.includes("VI"));
    if (viVoice) {
      utterance.voice = viVoice;
    }
    
    utterance.rate = 1.0; // Comfort speed
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      // Keeps character speaking
      setIsIdle(false);
    };

    utterance.onend = () => {
      // Returns character to idle 1-2s loop
      setIsIdle(true);
    };

    utterance.onerror = () => {
      setIsIdle(true);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Submit dynamic query to full-stack Express API
  const handleQuery = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Cancel active speaking immediately when new input begins
    if (speechSynthesisAvailable) {
      window.speechSynthesis.cancel();
    }

    const citizenQuestion = text.trim();
    setInputText("");

    // Append user query to thread
    const userMsg: Message = {
      id: "msg-" + Date.now() + Math.random().toString(36).substring(4),
      role: "user",
      content: citizenQuestion,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    
    // Set Avatar State to ACTIVE speaking loop (releases from 1-2s limits)
    setIsIdle(false);

    try {
      const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      let answer = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: citizenQuestion,
            history: chatHistory
          })
        });

        if (res.ok) {
          const data = await res.json();
          answer = data.reply;
        } else {
          throw new Error("Lỗi kết nối máy chủ dịch vụ công.");
        }
      } catch (backendErr) {
        console.warn("Express backend /api/chat is not responding or 404 (expected on static Netlify host). Resorting to direct client-side Gemini call...", backendErr);
        
        // Client-side fallback using the VITE_GEMINI_API environment variable
        const apiKey = (import.meta as any).env?.VITE_GEMINI_API;
        if (!apiKey) {
          throw new Error("API Key cấu hình không hợp lệ.");
        }
        
        // Support trying models (gemini-1.5-flash, gemini-2.5-flash, gemini-2.0-flash)
        const models = ["gemini-1.5-flash", "gemini-2.0-flash"];
        let success = false;
        
        const systemInstruction = 
          "Bạn là một Trợ lý Công dân thông thái (Trợ lý hành chính công, tư vấn dịch vụ công trực tuyến, " +
          "hướng dẫn làm giấy tờ, thủ tục hành chính như đăng ký khai sinh, căn cước công dân, hộ chiếu, bảo hiểm, đất đai, thuế...). " +
          "Hãy trả lời một cách cực kỳ lịch sự, chu đáo, ấm áp, kiên nhẫn và chính xác. Trình bày nội dung đẹp đẽ, rõ ràng, " +
          "sử dụng các gạch đầu dòng, các bước hành động cụ thể để người dân dễ hiểu. Gọi người dùng là 'quý công dân' hoặc 'anh/chị', " +
          "xưng là 'Tôi' hoặc 'Trợ lý'. Luôn động viên nhiệt tình và thiện chí giúp đỡ.";

        // Format history according to Gemini's native format
        const contents: any[] = chatHistory.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));
        
        contents.push({
          role: "user",
          parts: [{ text: citizenQuestion }]
        });

        for (const model of models) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const clientRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents,
                systemInstruction: {
                  parts: [{ text: systemInstruction }]
                },
                generationConfig: {
                  temperature: 0.7
                }
              })
            });

            if (clientRes.ok) {
              const data = await clientRes.json();
              if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                answer = data.candidates[0].content.parts[0].text;
                success = true;
                break;
              }
            }
          } catch (modelErr) {
            console.error(`Direct call with model ${model} failed:`, modelErr);
          }
        }

        if (!success) {
          throw new Error("Không thể kết nối trực tiếp đến API của Gemini bằng mã khóa.");
        }
      }

      // Append AI Reply to thread
      const assistantMsg: Message = {
        id: "msg-" + Date.now() + Math.random().toString(36).substring(4),
        role: "assistant",
        content: answer,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
      setIsLoading(false);

      if (isTtsEnabled) {
        speakText(answer);
      } else {
        // Fallback: Speak duration is estimated by length if TTS is disabled
        // Let it speak/play fully for a duration corresponding to response length, then return to idle
        const readTimeMs = Math.max(4000, Math.min(12000, answer.length * 30));
        setTimeout(() => {
          setIsIdle(true);
        }, readTimeMs);
      }

    } catch (err: any) {
      console.error(err);
      const errMsg: Message = {
        id: "msg-" + Date.now() + Math.random().toString(36).substring(4),
        role: "assistant",
        content: "Không thể kết nối đến máy chủ AI Phục vụ Công dân. Xin lỗi quý công dân, hệ thống hiện đang quá tải hoặc cấu hình API Key chưa hoàn tất. Vui lòng thử lại sau.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errMsg]);
      setIsLoading(false);
      setIsIdle(true);
    }
  };

  // Video Drag and Drop Handling
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadVideoFile(e.dataTransfer.files[0]);
    }
  };

  // File import selector helper
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadVideoFile(e.target.files[0]);
    }
  };

  const loadVideoFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      alert("Quý công dân vui lòng chọn đúng định dạng video (.mp4, .webm).");
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setVideoSource(blobUrl);
    setVideoSourceName(file.name);
    setIsCustomVideo(true);
    setIsIdle(true); // Return to default loop behavior
    
    // Attempt play
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 1.0;
        videoRef.current.play().catch(e => console.log("Init play failed: ", e));
      }
    }, 150);
  };

  const resetToDefaultSample = () => {
    setVideoSource(SAMPLES[0].url);
    setVideoSourceName(SAMPLES[0].name);
    setIsCustomVideo(false);
    setIsIdle(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 1.0;
    }
  };

  return (
    <div id="citizen_assistant_root" className="min-h-screen bg-[#0a0a0a] text-neutral-200 font-sans flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      
      {/* 🇻🇳 Elegant Dark Administrative Navigation */}
      <nav id="assistant_header" className="h-16 px-6 sm:px-8 border-b border-neutral-800 flex items-center justify-between bg-[#0f0f0f] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div id="emblem_logo" className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg relative overflow-hidden flex-shrink-0">
            <span className="text-xs font-bold text-white">AI</span>
          </div>
          <div className="text-left">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white uppercase flex items-center gap-2">
              Trợ Lý Công Dân
              <span className="hidden sm:inline-block px-2 py-0.5 text-[9px] font-bold text-cyan-400 bg-cyan-950/40 rounded-full border border-cyan-800/30">Hành Chính Số</span>
            </h1>
          </div>
        </div>
        
        {/* Navigation & Status items */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-6 text-xs sm:text-sm font-medium text-neutral-400">
            <span className="text-cyan-400 cursor-default">Trang chủ</span>
            <span className="hover:text-white transition-colors cursor-default">Thủ tục</span>
            <span className="hover:text-white transition-colors cursor-default">Bảo mật</span>
          </div>

          <span id="system_status_tag" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/40 border border-cyan-800/30 rounded-full text-[10px] font-semibold text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            Tổng Đài Mã Hóa SSL
          </span>

          {speechSynthesisAvailable && (
            <button
              id="tts_toggle_btn"
              onClick={() => setIsTtsEnabled(!isTtsEnabled)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all duration-300 ${
                isTtsEnabled 
                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-900/20" 
                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
              title={isTtsEnabled ? "Tắt phát âm thanh" : "Bật phát âm thanh"}
            >
              {isTtsEnabled ? <Volume2 className="w-3.5 h-3.5 animate-bounce" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="text-[10px] uppercase font-bold">{isTtsEnabled ? "Đầu ra Voice: Mở" : "Mute (Giọng)"}</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main content grid */}
      <main id="app_main_container" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Glow Halos backgrounds mimicking Elegant Dark */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* LEFT COLUMN: The Interactive Mascot Board (5 cols) */}
        <section id="mascot_column" className="lg:col-span-5 flex flex-col gap-6 relative z-10">
          
          {/* Video Avatar Card styled like Elegant Dark simulated layout */}
          <div id="video_avatar_card" className="bg-[#0f0f0f] rounded-2xl border border-neutral-800 shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-neutral-800 bg-[#0c0c0c] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-xs text-neutral-300 uppercase tracking-widest">Bảng Trình Chiếu Khách Thể</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Visual state pill */}
                {isIdle ? (
                  <span id="playing_status" className="px-2.5 py-0.5 rounded-full text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-cyan-400"></span>
                    MỎ LẶP (1s - 2s)
                  </span>
                ) : (
                  <span id="playing_status" className="px-2.5 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 font-mono tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></span>
                    ĐÀI THOẠI (TOÀN BỘ)
                  </span>
                )}
              </div>
            </div>

            {/* Live Video Stage in black aspect-video container with elegant cyan glows */}
            <div id="video_stage" className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group border-b border-neutral-800">
              <video
                id="avatar_player"
                ref={videoRef}
                src={videoSource}
                muted={isMuted}
                autoPlay
                playsInline
                loop={true}
                onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 0)}
                className="w-full h-full object-cover pointer-events-none"
              />
              
              {/* Overlay telemetry and Loop settings info */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-neutral-400 border border-neutral-800">
                Playhead: <span className="text-cyan-400 font-bold">{playbackTime.toFixed(2)}s</span> / {videoDuration > 0 ? `${videoDuration.toFixed(1)}s` : "..."}
              </div>

              {/* Live sync decoration */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 flex items-center gap-1.5 pointer-events-none">
                <div className={`w-1.5 h-1.5 rounded-full ${isIdle ? 'bg-cyan-500' : 'bg-green-500 animate-pulse'}`}></div>
                <span className="text-[9px] font-bold text-white uppercase tracking-wider">
                  {isIdle ? "Trạng Thái Chờ" : "Tương Tác Phản Hồi"}
                </span>
              </div>

              {/* Volume status button */}
              <button
                id="unmute_video_trigger"
                onClick={() => setIsMuted(!isMuted)}
                className="absolute bottom-3 right-3 bg-black/75 hover:bg-[#141414] border border-neutral-800 p-2 rounded-full text-white cursor-pointer transition-all hover:scale-110 flex items-center justify-center"
                title={isMuted ? "Bật âm thanh video" : "Tắt âm thanh video"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-neutral-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
              </button>

              {/* Controls Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4">
                <button
                  id="play_pause_trigger"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="bg-neutral-900 border border-neutral-800 text-white rounded-full p-3 shadow-lg cursor-pointer hover:bg-neutral-800 transition-all hover:scale-105"
                >
                  {isPlaying ? <Pause className="w-5 h-5 text-cyan-400" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  id="rewind_trigger"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                    }
                  }}
                  className="bg-neutral-900 border border-neutral-800 text-white rounded-full p-3 shadow-lg cursor-pointer hover:bg-neutral-800 transition-all hover:scale-105"
                  title="Tua về giây 0"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video telemetry / controller adjustments */}
            <div className="p-4 bg-[#0a0a0a] flex flex-col gap-4">
              
              {/* Timeline map visualizing current state */}
              <div>
                <div className="flex justify-between text-[11px] text-neutral-400 mb-1.5">
                  <span className="font-mono">Chu kỳ của khung video:</span>
                  <span className="text-cyan-400 font-mono font-bold">{((playbackTime / (videoDuration || 1)) * 100).toFixed(0)}%</span>
                </div>
                {/* Visual seeker bar */}
                <div className="relative w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                  {/* Total duration progress */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-neutral-750 transition-all duration-75"
                    style={{ width: `${(playbackTime / (videoDuration || 1)) * 100}%` }}
                  />
                  {/* Idle loop highlighted range */}
                  <div 
                    className="absolute top-0 h-full bg-cyan-500/20 border-l border-r border-cyan-500/60"
                    style={{ 
                      left: `${(idleStart / (videoDuration || 1)) * 100}%`,
                      width: `${((idleEnd - idleStart) / (videoDuration || 1)) * 100}%` 
                    }}
                  />
                  {/* Current handle position */}
                  <div 
                    className="absolute top-0 w-0.5 bg-cyan-400 h-full transition-all duration-75"
                    style={{ left: `${(playbackTime / (videoDuration || 1)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1.5">
                  <span>0s</span>
                  <span className="text-cyan-400">Khung Chờ Lặp (Giây {idleStart}-{idleEnd})</span>
                  <span>{videoDuration > 0 ? `${videoDuration.toFixed(1)}s` : "..."}</span>
                </div>
              </div>

              {/* Loop intervals tuner widget */}
              <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Thiết Lập Chờ (Mặc định: 1s - 2s)</span>
                  </div>
                  <button
                    id="reset_loop_values"
                    onClick={() => {
                      setIdleStart(1.0);
                      setIdleEnd(2.0);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer bg-neutral-800 hover:bg-neutral-750 px-2 py-0.5 rounded"
                  >
                    Mặc Định
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1 font-semibold uppercase tracking-wider">Giây Bắt Đầu</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="0" 
                        max={Math.max(0, idleEnd - 0.5)} 
                        step="0.1"
                        value={idleStart}
                        onChange={(e) => setIdleStart(parseFloat(e.target.value))}
                        className="w-full accent-cyan-500 cursor-pointer h-1 bg-neutral-800 rounded-lg appearance-none"
                      />
                      <span className="font-mono text-xs text-cyan-400 bg-black/40 px-1.5 py-0.5 rounded border border-neutral-800 w-10 text-center">{idleStart.toFixed(1)}s</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1 font-semibold uppercase tracking-wider">Giây Kết Thúc</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min={idleStart + 0.5} 
                        max={Math.max(10, videoDuration || 10)} 
                        step="0.1"
                        value={idleEnd}
                        onChange={(e) => setIdleEnd(parseFloat(e.target.value))}
                        className="w-full accent-cyan-500 cursor-pointer h-1 bg-neutral-800 rounded-lg appearance-none"
                      />
                      <span className="font-mono text-xs text-cyan-400 bg-black/40 px-1.5 py-0.5 rounded border border-neutral-800 w-10 text-center">{idleEnd.toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Interactive Source Manager with elegant Elegant Dark design guidelines */}
          <div id="video_selector_card" className="bg-[#0f0f0f] rounded-2xl border border-neutral-800 p-4 sm:p-5 shadow-lg flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-2 mb-1">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                Dữ Liệu Đầu Vào Video MP4
              </h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">Cách thức tải video hành chính mẫu lên hệ thống trực quan, hỗ trợ so khớp khẩu hình ảo.</p>
            </div>

            {/* Custom file Drag & Drop container */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 bg-black/40 relative overflow-hidden group ${
                dragActive ? "border-cyan-500 bg-cyan-500/5" : "border-neutral-800 hover:border-neutral-700 hover:bg-[#121212]"
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="video/*" 
                className="hidden" 
              />
              <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Upload className="w-4 h-4 text-neutral-400 group-hover:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-300">Tải tệp MP4 hoặc Kéo & thả</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Xử lý cục bộ bảo mật, an toàn tuyệt đối</p>
              </div>
            </div>

            {/* Default Presets list */}
            <div>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Chọn Avatar Công Chức Có Sẵn:</p>
              <div className="flex flex-col gap-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => {
                      setVideoSource(sample.url);
                      setVideoSourceName(sample.name);
                      setIsCustomVideo(false);
                      setIsIdle(true);
                    }}
                    className={`text-left p-2.5 rounded-lg text-xs border cursor-pointer transition-all ${
                      videoSource === sample.url && !isCustomVideo
                        ? "bg-cyan-950/20 border-cyan-800/80 text-cyan-300 shadow-[0_0_15px_rgba(8,145,178,0.05)]"
                        : "bg-neutral-950 hover:bg-neutral-900 border-neutral-900 text-neutral-400"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${videoSource === sample.url && !isCustomVideo ? "bg-cyan-400" : "bg-neutral-850"}`}></span>
                      {sample.name}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate mt-0.5">{sample.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current loaded details notification */}
            <div className="bg-black/35 p-3 rounded-lg text-xs border border-neutral-900 flex items-center justify-between gap-2.5">
              <div className="truncate min-w-0">
                <div className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">Tệp video đang dùng</div>
                <div className="text-cyan-400 font-semibold truncate text-[11px] mt-0.5">
                  {videoSourceName}
                </div>
              </div>
              {isCustomVideo && (
                <button
                  onClick={resetToDefaultSample}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-medium shrink-0 hover:underline cursor-pointer"
                >
                  Gỡ bỏ
                </button>
              )}
            </div>

          </div>

        </section>

        {/* RIGHT COLUMN: The Interactive Telegram-style Admin Chat Box (7 cols) */}
        <section id="chat_column" className="lg:col-span-7 flex flex-col bg-[#0d0d0d] rounded-2xl border border-neutral-800 shadow-xl overflow-hidden min-h-[620px] lg:h-[calc(100vh-96px)]">
          
          {/* Header Area representing elegant top layout of design mockup */}
          <div className="p-4 border-b border-neutral-850 bg-[#0f0f0f] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 flex-shrink-0 flex items-center justify-center border border-neutral-800">
                <span className="text-[10px] text-cyan-400 font-bold italic tracking-tighter">AI</span>
              </div>
              <div>
                <h2 className="font-bold text-xs tracking-widest text-[#ffffff] uppercase">BẢNG LÀM VIỆC CÔNG DÂN • 24/7</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="text-[11px] text-neutral-400">Gemini 3.5 Công Nghệ Cao</span>
                </div>
              </div>
            </div>
            
            {/* Quick stats on interaction */}
            <div className="hidden sm:block text-right">
              <span className="text-[10px] bg-black/60 border border-neutral-800 px-2 py-0.5 rounded font-mono text-neutral-400 uppercase tracking-widest">
                Thread: {messages.length} msg
              </span>
            </div>
          </div>

          {/* Interactive Hint Banner mimicking Elegant Dark with solid background to prevent see-through overlapping text */}
          <div className="px-5 py-3 border-b border-neutral-850 bg-neutral-950 text-center flex-shrink-0 z-10">
            <h2 className="text-sm sm:text-base font-light text-white italic font-serif">Xin chào, tôi có thể hỗ trợ gì cho Quý công dân?</h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">Mỗi câu hỏi sẽ tự động nạp phản hồi và kích hoạt cử động miệng/cơ mặt trên Mascot lặp tự nhiên.</p>
          </div>

          {/* Conversation Thread Area */}
          <div ref={messagesContainerRef} id="messages_thread_scroller" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-black/10 space-y-5">
            
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  id={`message-bubble-${msg.id}`}
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-3.5 ${msg.role === "user" ? "justify-end flex-row-reverse" : "justify-start"}`}
                >
                  {msg.role !== "user" ? (
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex-shrink-0 flex items-center justify-center shadow-md">
                      <span className="text-[10px] text-cyan-400 font-bold">AI</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-cyan-600 border border-cyan-500 flex-shrink-0 flex items-center justify-center shadow-[0_0_15px_rgba(8,145,178,0.3)]">
                      <span className="text-[10px] text-white font-bold">BẠN</span>
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[88%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    
                    {/* Timestamp & label info */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider font-mono">
                        {msg.role === "user" ? "BẢN THÂN" : "TRỢ LÝ SỐ"}
                      </span>
                      <span className="text-[9px] text-neutral-600 font-mono">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Chat Bubble container containing formatted paragraph texts */}
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-cyan-950/40 border border-cyan-850 rounded-tr-none text-cyan-50"
                          : "bg-neutral-900 border border-neutral-800 rounded-tl-none text-neutral-300"
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Audio trigger TTS speaker button */}
                    {msg.role === "assistant" && speechSynthesizablre() && (
                      <button
                        onClick={() => speakText(msg.content)}
                        className="mt-1.5 text-[10px] text-neutral-500 hover:text-cyan-400 flex items-center gap-1.5 bg-neutral-950 border border-neutral-850 px-2.5 py-1 rounded cursor-pointer transition-all duration-200"
                        title="Phát thanh thuyết minh"
                      >
                        <Volume2 className="w-3 h-3 text-cyan-400" />
                        Đọc bằng Trình giả thanh
                      </button>
                    )}

                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Active thinking loops */}
            {isLoading && (
              <motion.div
                id="thinking_indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3.5 justify-start"
              >
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[10px] text-cyan-400 font-bold animate-ping">●</span>
                </div>
                <div className="flex flex-col">
                  <div className="text-[10px] text-[#888888] mb-1 italic">Hệ thống đang truy vết thông tin...</div>
                  <div className="bg-neutral-900 border border-neutral-850 text-neutral-400 p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                    {/* Bounce dots styled custom to match Elegant Dark */}
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-neutral-500 italic ml-2">Video đang phát toàn bộ...</span>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* Preset Suggested Questions list in horizontally scrollable line to save layout space */}
          <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-850 shadow-inner flex-shrink-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-cyan-400 mb-1.5 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-cyan-400" />
              Câu hỏi đề xuất hỗ trợ nhanh:
            </p>
            <div className="flex flex-row gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleQuery(sug)}
                  disabled={isLoading}
                  className="text-[11px] bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg cursor-pointer text-left transition-all hover:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-1 flex-shrink-0 whitespace-nowrap"
                >
                  <span>{sug}</span>
                  <ChevronRight className="w-3 h-3 text-neutral-500 ml-1 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Area resembling mock template style */}
          <div className="p-4 sm:p-5 bg-[#0f0f0f] border-t border-neutral-850 flex-shrink-0">
            <form
              id="citizen_chat_form"
              onSubmit={(e) => {
                e.preventDefault();
                handleQuery(inputText);
              }}
              className="relative"
            >
              <textarea
                id="citizen_chat_input"
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim() && !isLoading) {
                      handleQuery(inputText);
                    }
                  }
                }}
                placeholder="Nhập câu hỏi hành chính công trực tuyến của bạn tại đây (Nhấn Enter để gửi)..."
                disabled={isLoading}
                className="w-full bg-black border border-neutral-700 focus:border-cyan-500/80 rounded-2xl py-3.5 pl-4 pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/40 text-neutral-100 placeholder-neutral-500 transition-all resize-none min-h-[64px]"
              />
              <button
                id="sumbit_query_btn"
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="absolute bottom-4 right-4 w-9 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white flex items-center justify-center transition-all shadow-lg shadow-cyan-900/20 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.98]"
                title="Gửi câu hỏi"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>

            <div className="mt-3.5 flex flex-col sm:flex-row justify-between items-center text-[10px] text-neutral-500 tracking-wider font-semibold uppercase gap-2">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-cyan-400" />
                Chu kỳ chờ: Nhàn rỗi tự động lặp giữ từ giây 1-2
              </span>
              <span className="text-neutral-600 tracking-normal normal-case">
                AI Assistant v2.0 • Google AI Studio Build
              </span>
            </div>
          </div>

        </section>

      </main>

      {/* Elegant Dark compliant footer */}
      <footer id="assistant_app_footer" className="bg-[#0b0b0b] py-6 border-t border-neutral-850 text-neutral-400 mt-auto text-xs">
        <div className="max-w-7xl mx-auto px-6 divide-y divide-neutral-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-bold text-neutral-200 mb-2 uppercase tracking-widest text-[11px]">Hành trình thông minh</h4>
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Tích hợp mượt mà giữa loop engine thời lượng siêu nhỏ của video và trí tuệ nhân tạo Gemini 3.5, mang lại trải nghiệm tư vấn thực tế sống động.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-neutral-200 mb-2 uppercase tracking-widest text-[11px]">Bảo mật thông tin</h4>
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Toàn bộ cuộc trò chuyện được truyền dạng mã hóa một chiều qua giao thức SSL. Dữ liệu video nạp từ trình duyệt được giữ bí mật cục bộ.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-neutral-200 mb-2 uppercase tracking-widest text-[11px]">Cơ chế lặp mượt mà</h4>
              <p className="text-[11px] leading-relaxed text-neutral-500 font-mono text-cyan-400/90 bg-black/40 p-2 rounded border border-neutral-850">
                Sử dụng requestAnimationFrame khép kín để bắt giữ khung hình lặp 1.0s - 2.0s hoàn mỹ không chập chờn.
              </p>
            </div>
          </div>
          <div className="pt-4 text-center text-[11px] text-neutral-600 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>© 2026 Cổng Giao Tiếp Hành Chính Trực Tuyến Công Dân • Bảo Lưu Mọi Quyền</span>
            <span className="flex items-center gap-1.5 text-neutral-500 font-medium">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              Tương Tác Mascot Kỹ Thuật Số Cao Cấp
            </span>
          </div>
        </div>
      </footer>
    </div>
  );

  // Quick safety utility for window checklist
  function speechSynthesizablre() {
    return typeof window !== "undefined" && window.speechSynthesis;
  }
}
