import React, { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2, RefreshCw, BookOpen, Clock, AlertCircle, Moon, Sun, Upload, FileText, X, Download, Edit2, Save, ArrowLeft, ExternalLink, ChevronDown, ChevronUp, Link as LinkIcon } from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MagicCard, MagicCardContainer } from "@/components/MagicCard";
import GradientText from "@/components/GradientText";
import Silk from "@/components/Silk";
import ScrollVelocity from "@/components/ScrollVelocity";

type Topic = {
  name: string;
  difficulty: "easy" | "medium" | "hard";
};

type Subject = {
  name: string;
  examDate?: Date;
  topics: Topic[];
  links?: { name: string; url: string }[];
};

type Task = {
  subject: string;
  topic: string;
  description?: string;
  durationHours: number;
  type: string;
  priority: "high" | "medium" | "low";
  completed?: boolean;
  notes?: string;
  referenceUrl?: string;
  referenceName?: string;
};

type DayPlan = {
  date: string;
  tasks: Task[];
  isDayOff?: boolean;
};

type StudyPlan = {
  id: string;
  title: string;
  createdAt: string;
  plan: DayPlan[];
  suggestions: string[];
};

export default function App() {
  const [examDate, setExamDate] = useState<Date>();
  const [dailyHours, setDailyHours] = useState<number>(4);
  const [subjects, setSubjects] = useState<Subject[]>([
    { name: "", topics: [{ name: "", difficulty: "medium" }], links: [] },
  ]);
  const [expandedSubjects, setExpandedSubjects] = useState<number[]>([0]);
  const [loading, setLoading] = useState(false);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [documents, setDocuments] = useState<File[]>([]);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    
    // Log visit to server console
    fetch('/api/log/visit', { method: 'POST' }).catch(console.error);
    
    return () => clearTimeout(timer);
  }, []);

  const activePlan = studyPlans.find(p => p.id === activePlanId) || null;

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleSyllabusImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.every(s => s.name && Array.isArray(s.topics))) {
            setSubjects(parsed);
          } else {
            setError("Invalid JSON format for syllabus.");
          }
        } else if (file.name.endsWith(".csv")) {
          const lines = content.split("\n").filter(l => l.trim());
          const newSubjects: Record<string, Subject> = {};
          
          const startIndex = lines[0].toLowerCase().includes("subject") ? 1 : 0;
          
          for (let i = startIndex; i < lines.length; i++) {
            const parts = lines[i].split(",");
            const subjectName = parts[0]?.trim();
            const topicName = parts[1]?.trim();
            const difficulty = parts[2]?.trim().toLowerCase() as "easy" | "medium" | "hard";
            
            if (subjectName && topicName) {
              if (!newSubjects[subjectName]) {
                newSubjects[subjectName] = { name: subjectName, topics: [] };
              }
              newSubjects[subjectName].topics.push({
                name: topicName,
                difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium"
              });
            }
          }
          
          const subjectsArray = Object.values(newSubjects);
          if (subjectsArray.length > 0) {
            setSubjects(subjectsArray);
          } else {
            setError("No valid data found in CSV.");
          }
        } else {
          setError("Unsupported file format. Please upload a .json or .csv file.");
        }
      } catch (err) {
        setError("Failed to parse file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const addSubject = () => {
    setSubjects([...subjects, { name: "", topics: [{ name: "", difficulty: "medium" }], links: [] }]);
    setExpandedSubjects([...expandedSubjects, subjects.length]);
  };

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
    setExpandedSubjects(expandedSubjects.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateSubjectName = (index: number, name: string) => {
    const newSubjects = [...subjects];
    newSubjects[index].name = name;
    setSubjects(newSubjects);
  };

  const updateSubjectDate = (index: number, date: Date | undefined) => {
    const newSubjects = [...subjects];
    newSubjects[index].examDate = date;
    setSubjects(newSubjects);
  };

  const toggleSubjectExpansion = (index: number) => {
    setExpandedSubjects(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const addLink = (subjectIndex: number) => {
    const newSubjects = [...subjects];
    if (!newSubjects[subjectIndex].links) {
      newSubjects[subjectIndex].links = [];
    }
    newSubjects[subjectIndex].links.push({ name: "", url: "" });
    setSubjects(newSubjects);
  };

  const updateLink = (subjectIndex: number, linkIndex: number, field: "name" | "url", value: string) => {
    const newSubjects = [...subjects];
    if (newSubjects[subjectIndex].links && newSubjects[subjectIndex].links[linkIndex]) {
      newSubjects[subjectIndex].links[linkIndex][field] = value;
      setSubjects(newSubjects);
    }
  };

  const removeLink = (subjectIndex: number, linkIndex: number) => {
    const newSubjects = [...subjects];
    if (newSubjects[subjectIndex].links) {
      newSubjects[subjectIndex].links.splice(linkIndex, 1);
      setSubjects(newSubjects);
    }
  };

  const addTopic = (subjectIndex: number) => {
    const newSubjects = [...subjects];
    newSubjects[subjectIndex].topics.push({ name: "", difficulty: "medium" });
    setSubjects(newSubjects);
  };

  const removeTopic = (subjectIndex: number, topicIndex: number) => {
    const newSubjects = [...subjects];
    newSubjects[subjectIndex].topics = newSubjects[subjectIndex].topics.filter((_, i) => i !== topicIndex);
    setSubjects(newSubjects);
  };

  const updateTopic = (subjectIndex: number, topicIndex: number, field: keyof Topic, value: string) => {
    const newSubjects = [...subjects];
    newSubjects[subjectIndex].topics[topicIndex] = {
      ...newSubjects[subjectIndex].topics[topicIndex],
      [field]: value,
    };
    setSubjects(newSubjects);
  };

  const generatePlan = async () => {
    const hasGlobalExamDate = !!examDate;
    const hasSubjectExamDates = subjects.every(s => s.examDate);
    
    if (!hasGlobalExamDate && !hasSubjectExamDates) {
      setError("Please select an overall target date or specify an exam date for each subject.");
      return;
    }

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      if (!subject.name.trim()) {
        setError(`Subject ${i + 1} is missing a name.`);
        return;
      }
      if (subject.topics.length === 0) {
        setError(`Subject "${subject.name}" must have at least one topic.`);
        return;
      }
      for (let j = 0; j < subject.topics.length; j++) {
        const topic = subject.topics[j];
        if (!topic.name.trim()) {
          setError(`Topic ${j + 1} in subject "${subject.name}" is missing a name.`);
          return;
        }
        if (!topic.difficulty) {
          setError(`Topic "${topic.name}" in subject "${subject.name}" is missing a difficulty level.`);
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Log generation to server console
      fetch('/api/log/generate', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subjects: subjects.map(s => s.name).join(', '),
          examDate: examDate ? format(examDate, "yyyy-MM-dd") : "Not specified"
        })
      }).catch(console.error);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in the environment.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const documentParts = await Promise.all(documents.map(async (file) => {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        return {
          inlineData: {
            data: base64,
            mimeType: file.type || "application/pdf"
          }
        };
      }));

      const promptText = `
        You are an AI study and skill-learning planner. Create a detailed daily plan based on the following constraints:
        - Start Date (Today): ${format(new Date(), "yyyy-MM-dd")}
        ${examDate ? `- Overall Target Date (Exam/Goal): ${format(examDate, "yyyy-MM-dd")}` : ""}
        - Subjects, Skills, or Topics: ${JSON.stringify(subjects)}
        - Daily Study Hours: ${dailyHours}

        ${documents.length > 0 ? "I have also provided some reference documents. Please analyze them to understand the depth and context of the topics, and adjust the plan accordingly to make it more accurate and tailored." : ""}

        Distribute the topics logically across the available days leading up to the target dates starting from today.
        If a subject has a specific 'examDate', prioritize studying its topics before that specific date.
        Consider topic difficulty if provided.
        Assign a priority (high, medium, low) to each task based on its importance and difficulty.
        Include revision or practice days.
        For each topic, provide a helpful reference website or resource link. IMPORTANT: To prevent broken links, DO NOT guess specific URLs. Instead, provide a highly reliable generic link (like https://www.khanacademy.org) OR provide a Google Search URL (e.g., https://www.google.com/search?q=your+search+query) or a YouTube search URL (e.g., https://www.youtube.com/results?search_query=your+search+query) so the user can easily find valid resources.
        Also provide a brief 2-3 sentence description of what the user needs to cover or practice for this topic.
        
        Return the response as a JSON object with the following structure:
        {
          "plan": [
            {
              "date": "YYYY-MM-DD",
              "tasks": [
                {
                  "subject": "Subject Name",
                  "topic": "Topic Name",
                  "description": "A brief description of the topic and what to focus on.",
                  "durationHours": 2,
                  "type": "study" | "revision",
                  "priority": "high" | "medium" | "low",
                  "referenceUrl": "https://example.com/study-link",
                  "referenceName": "Example Resource Name"
                }
              ]
            }
          ],
          "suggestions": [
            "Suggestion 1",
            "Suggestion 2"
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            ...documentParts,
            { text: promptText }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    tasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          subject: { type: Type.STRING },
                          topic: { type: Type.STRING },
                          description: { type: Type.STRING, description: "A brief description of the topic and what to focus on" },
                          durationHours: { type: Type.NUMBER },
                          type: { type: Type.STRING },
                          priority: { type: Type.STRING, description: "high, medium, or low" },
                          referenceUrl: { type: Type.STRING, description: "URL to a reference website or resource" },
                          referenceName: { type: Type.STRING, description: "Name of the reference website or resource" }
                        },
                        required: ["subject", "topic", "description", "durationHours", "type", "priority"]
                      }
                    }
                  },
                  required: ["date", "tasks"]
                }
              },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["plan", "suggestions"]
          }
        }
      });

      if (!response.text) {
        throw new Error("Received empty response from AI");
      }

      const data = JSON.parse(response.text);
      const newPlan: StudyPlan = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        title: `Plan for ${examDate ? format(examDate, "MMM d, yyyy") : "Multiple Exams"} (${subjects.length} subjects)`,
        createdAt: new Date().toISOString(),
        plan: data.plan,
        suggestions: data.suggestions,
      };
      
      setStudyPlans(prev => [newPlan, ...prev]);
      setActivePlanId(newPlan.id);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateActivePlan = (updatedPlan: StudyPlan) => {
    setStudyPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  const markMissedDay = async (date: string) => {
    if (!activePlan) return;
    
    // In a real app, we'd send the missed day to the backend and recalculate.
    // For this prototype, we'll just regenerate the plan from today.
    generatePlan();
  };

  const updateTaskDuration = (dayIndex: number, taskIndex: number, newDuration: number) => {
    if (!activePlan) return;
    const newPlan = { ...activePlan };
    newPlan.plan[dayIndex].tasks[taskIndex].durationHours = newDuration;
    updateActivePlan(newPlan);
  };

  const moveTask = (fromDayIndex: number, taskIndex: number, toDate: string) => {
    if (!activePlan || activePlan.plan[fromDayIndex].date === toDate) return;
    const newPlan = { ...activePlan };
    
    const taskToMove = newPlan.plan[fromDayIndex].tasks[taskIndex];
    newPlan.plan[fromDayIndex].tasks.splice(taskIndex, 1);
    
    const toDayIndex = newPlan.plan.findIndex(day => day.date === toDate);
    if (toDayIndex !== -1) {
      newPlan.plan[toDayIndex].tasks.push(taskToMove);
      newPlan.plan[toDayIndex].isDayOff = false;
    } else {
      newPlan.plan.push({
        date: toDate,
        tasks: [taskToMove],
        isDayOff: false
      });
      newPlan.plan.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    
    updateActivePlan(newPlan);
    toast.success(`Task moved to ${format(new Date(toDate), "MMM d, yyyy")}`);
  };

  const toggleTaskCompletion = (dayIndex: number, taskIndex: number) => {
    if (!activePlan) return;
    const newPlan = { ...activePlan };
    newPlan.plan[dayIndex].tasks[taskIndex].completed = !newPlan.plan[dayIndex].tasks[taskIndex].completed;
    updateActivePlan(newPlan);
  };

  const updateTaskPriority = (dayIndex: number, taskIndex: number, priority: "high" | "medium" | "low") => {
    if (!activePlan) return;
    const newPlan = { ...activePlan };
    newPlan.plan[dayIndex].tasks[taskIndex].priority = priority;
    updateActivePlan(newPlan);
  };

  const updateTaskField = (dayIndex: number, taskIndex: number, field: keyof Task, value: any) => {
    if (!activePlan) return;
    const newPlan = { ...activePlan };
    newPlan.plan[dayIndex].tasks[taskIndex] = {
      ...newPlan.plan[dayIndex].tasks[taskIndex],
      [field]: value,
    };
    updateActivePlan(newPlan);
  };

  const deleteTask = (dayIndex: number, taskIndex: number) => {
    if (!activePlan) return;
    const newPlan = { ...activePlan };
    newPlan.plan[dayIndex].tasks.splice(taskIndex, 1);
    updateActivePlan(newPlan);
    toast.success("Task deleted successfully");
  };

  const toggleDayOff = (dayIndex: number) => {
    if (!activePlan) return;
    const newPlan = { ...activePlan };
    const newDays = newPlan.plan.map(day => ({ ...day, tasks: [...day.tasks] }));
    
    // Toggle the off status
    newDays[dayIndex].isDayOff = !newDays[dayIndex].isDayOff;
    
    // Collect all tasks from dayIndex onwards
    const tasksToRedistribute: Task[][] = [];
    for (let i = dayIndex; i < newDays.length; i++) {
      if (newDays[i].tasks.length > 0) {
        tasksToRedistribute.push(newDays[i].tasks);
      }
      newDays[i].tasks = [];
    }
    
    // Redistribute
    let currentDayIndex = dayIndex;
    let taskBlockIndex = 0;
    
    while (taskBlockIndex < tasksToRedistribute.length) {
      if (currentDayIndex >= newDays.length) {
        // Add a new day
        const lastDate = new Date(newDays[newDays.length - 1].date);
        const newDate = format(addDays(lastDate, 1), "yyyy-MM-dd");
        newDays.push({ date: newDate, tasks: [], isDayOff: false });
      }
      
      if (!newDays[currentDayIndex].isDayOff) {
        newDays[currentDayIndex].tasks = tasksToRedistribute[taskBlockIndex];
        taskBlockIndex++;
      }
      currentDayIndex++;
    }
    
    // Clean up trailing empty days that are not marked as off
    while (newDays.length > 1 && newDays[newDays.length - 1].tasks.length === 0 && !newDays[newDays.length - 1].isDayOff) {
      newDays.pop();
    }
    
    newPlan.plan = newDays;
    updateActivePlan(newPlan);
    
    if (newDays[dayIndex].isDayOff) {
      toast.success("Day marked as off. Tasks shifted to subsequent days.");
    } else {
      toast.success("Day restored. Tasks shifted back.");
    }
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
          >
            <div className="flex gap-4 mb-8">
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="w-10 h-10 rounded-full bg-[#4285F4] shadow-lg shadow-[#4285F4]/30"
              />
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-10 h-10 rounded-full bg-[#34A853] shadow-lg shadow-[#34A853]/30"
              />
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="w-10 h-10 rounded-full bg-[#FBBC05] shadow-lg shadow-[#FBBC05]/30"
              />
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                className="w-10 h-10 rounded-full bg-[#EA4335] shadow-lg shadow-[#EA4335]/30"
              />
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight text-foreground"
            >
              AI Study Planner
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-muted-foreground mt-3 text-lg"
            >
              Organizing your success...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSplash && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="min-h-screen bg-transparent text-foreground p-4 md:p-8 font-sans transition-colors duration-200 relative"
        >
          <div className="fixed inset-0 z-[-1] opacity-30 dark:opacity-20 pointer-events-none no-print">
            <Silk color={theme === 'dark' ? '#1a1a2e' : '#e0e5ec'} />
          </div>
          <div className="max-w-5xl mx-auto space-y-8 relative z-10">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight text-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <GradientText
                    colors={['#4285F4', '#0F9D58', '#F4B400', '#DB4437']}
                    animationSpeed={6}
                    className="font-heading"
                  >
                    AI-Based
                  </GradientText> 
                  Adaptive Study Planner
                </h1>
                <p className="text-muted-foreground text-lg">Generate a personalized, adaptive study schedule based on your syllabus and constraints.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={toggleTheme}>
                  {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </Button>
              </div>
            </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6 no-print">
            <Card>
              <CardHeader>
                <CardTitle>Constraints</CardTitle>
                <CardDescription>Set your target date and daily availability.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Overall Target Date <span className="text-muted-foreground font-normal">(Optional if subjects have dates)</span></Label>
                  <Popover>
                    <PopoverTrigger render={
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !examDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {examDate ? format(examDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    } />
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={examDate}
                        onSelect={setExamDate}
                        initialFocus
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Daily Study/Practice Hours</Label>
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    value={dailyHours}
                    onChange={(e) => setDailyHours(Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Syllabus & Skills</CardTitle>
                  <CardDescription>Add subjects, skills, and topics to cover.</CardDescription>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".json,.csv"
                    className="hidden"
                    id="syllabus-upload"
                    onChange={handleSyllabusImport}
                  />
                  <Label htmlFor="syllabus-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-md">
                      <Upload className="h-3 w-3" />
                      Import
                    </div>
                  </Label>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {subjects.map((subject, sIdx) => {
                  const isExpanded = expandedSubjects.includes(sIdx);
                  return (
                  <div key={sIdx} className="space-y-4 p-4 border rounded-lg bg-card relative transition-all duration-200">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 w-full">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 shrink-0" 
                          onClick={() => toggleSubjectExpansion(sIdx)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Input
                          placeholder="e.g. Mathematics, UI Design, AI Prompting"
                          value={subject.name}
                          onChange={(e) => updateSubjectName(sIdx, e.target.value)}
                          className="font-medium text-base h-10 flex-1"
                        />
                        {subjects.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeSubject(sIdx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="pl-10 w-full">
                        <Popover>
                          <PopoverTrigger render={
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full sm:w-[200px] justify-start text-left font-normal h-10",
                                !subject.examDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {subject.examDate ? format(subject.examDate, "MMM d, yyyy") : "Exam Date (Optional)"}
                              </span>
                            </Button>
                          } />
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={subject.examDate}
                              onSelect={(date) => updateSubjectDate(sIdx, date)}
                              initialFocus
                              disabled={(date) => date < new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pl-10 space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Topics / Sub-skills</Label>
                          </div>
                          {subject.topics.map((topic, tIdx) => (
                            <div key={tIdx} className="flex flex-col gap-3 p-3 bg-muted/20 rounded-md border border-border/50">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                                  {tIdx + 1}
                                </div>
                                <Input
                                  placeholder="Topic name"
                                  value={topic.name}
                                  onChange={(e) => updateTopic(sIdx, tIdx, "name", e.target.value)}
                                  className="flex-1 h-8"
                                />
                                {subject.topics.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => removeTopic(sIdx, tIdx)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <div className="w-full pl-8">
                                <div className="flex rounded-md shadow-sm w-full" role="group">
                                  {(["easy", "medium", "hard"] as const).map((level, i) => (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() => updateTopic(sIdx, tIdx, "difficulty", level)}
                                      className={cn(
                                        "px-3 py-1 text-xs font-medium border outline-none transition-colors flex-1 relative",
                                        i === 0 ? "rounded-l-md" : "-ml-px",
                                        i === 2 ? "rounded-r-md" : "",
                                        topic.difficulty === level 
                                          ? cn(
                                              "text-white z-10",
                                              level === "easy" && "bg-[#0F9D58] border-[#0F9D58]",
                                              level === "medium" && "bg-[#4285F4] border-[#4285F4]",
                                              level === "hard" && "bg-[#DB4437] border-[#DB4437]"
                                            )
                                          : cn(
                                              "bg-background border-input hover:bg-muted z-0",
                                              level === "easy" && "text-[#0F9D58]",
                                              level === "medium" && "text-[#4285F4]",
                                              level === "hard" && "text-[#DB4437]"
                                            )
                                      )}
                                    >
                                      <span 
                                        className={cn(topic.difficulty === level && "glitch-text")} 
                                        data-text={level.charAt(0).toUpperCase() + level.slice(1)}
                                      >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 border-dashed"
                            onClick={() => addTopic(sIdx)}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Add Topic
                          </Button>
                        </div>

                        <div className="space-y-3 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                              <LinkIcon className="h-3 w-3" /> External Resources
                            </Label>
                          </div>
                          {subject.links?.map((link, lIdx) => (
                            <div key={lIdx} className="flex items-center gap-2 p-2 bg-muted/20 rounded-md border border-border/50">
                              <div className="h-6 w-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                <LinkIcon className="h-3 w-3" />
                              </div>
                              <Input
                                placeholder="Resource Name"
                                value={link.name}
                                onChange={(e) => updateLink(sIdx, lIdx, "name", e.target.value)}
                                className="w-1/3 h-8 text-sm"
                              />
                              <Input
                                placeholder="https://..."
                                value={link.url}
                                onChange={(e) => updateLink(sIdx, lIdx, "url", e.target.value)}
                                className="flex-1 h-8 text-sm"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => removeLink(sIdx, lIdx)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 border-dashed"
                            onClick={() => addLink(sIdx)}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Add Resource Link
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )})}

                <Button variant="secondary" className="w-full" onClick={addSubject}>
                  <Plus className="mr-2 h-4 w-4" /> Add Subject
                </Button>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={generatePlan} disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating Plan...
                    </>
                  ) : (
                    "Generate Study Plan"
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reference Documents</CardTitle>
                <CardDescription>Upload documents for AI analysis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.docx,.csv"
                    className="hidden"
                    id="document-upload"
                    onChange={handleDocumentUpload}
                  />
                  <Label htmlFor="document-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-2 border-dashed rounded-lg p-6 hover:bg-muted/50">
                      <Upload className="h-5 w-5" />
                      Click to upload documents
                    </div>
                  </Label>
                </div>
                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded-md text-sm">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{doc.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeDocument(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {error && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            {activePlan ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <Button variant="ghost" size="sm" onClick={() => setActivePlanId(null)} className="no-print">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Plans
                  </Button>
                  <h2 className="text-xl font-semibold text-foreground truncate">{activePlan.title}</h2>
                </div>

                <Card className="bg-blue-500/10 border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      AI Strategic Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                      {activePlan.suggestions.map((suggestion, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-blue-500 font-bold">•</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">Your Schedule</h2>
                    <div className="flex items-center gap-2 no-print">
                      <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading}>
                        <Download className="mr-2 h-4 w-4" />
                        Print / Export PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => generatePlan()} disabled={loading}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                        Recalculate
                      </Button>
                    </div>
                  </div>

                  <MagicCardContainer className="grid gap-4" id="study-plan-content">
                    {activePlan.plan.map((day, i) => {
                      const completedCount = day.tasks.filter(t => t.completed).length;
                      const totalCount = day.tasks.length;
                      const planDates = activePlan.plan.map(d => ({
                        date: d.date,
                        formatted: format(new Date(d.date), "MMM d")
                      }));
                      
                      return (
                      <MagicCard key={i} className="overflow-hidden bg-card text-card-foreground border rounded-xl shadow-sm" enableTilt={false} enableMagnetism={false}>
                        <div className="bg-muted px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between border-b gap-2">
                          <div>
                            <div className="font-medium text-foreground">
                              {format(new Date(day.date), "EEEE, MMMM d, yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {day.isDayOff 
                                ? "Day Off" 
                                : totalCount > 0 
                                  ? `${completedCount} / ${totalCount} tasks completed` 
                                  : "No tasks"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 self-start sm:self-auto no-print",
                                day.isDayOff 
                                  ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20" 
                                  : "text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                              )}
                              onClick={() => toggleDayOff(i)}
                            >
                              {day.isDayOff ? "Restore Day" : "Take Day Off"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-500/10 h-8 self-start sm:self-auto no-print"
                              onClick={() => markMissedDay(day.date)}
                            >
                              Missed this day?
                            </Button>
                          </div>
                        </div>
                        <div className="divide-y">
                          {day.isDayOff ? (
                            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                              <Moon className="h-8 w-8 mb-2 opacity-50" />
                              <p>You've marked this day as a day off.</p>
                              <p className="text-sm opacity-70">Take a break and recharge!</p>
                            </div>
                          ) : (
                            <>
                              {day.tasks.map((task, j) => (
                                <TaskRow
                                  key={j}
                                  task={task}
                                  dayIndex={i}
                                  taskIndex={j}
                                  planDates={planDates}
                                  currentDate={day.date}
                                  toggleTaskCompletion={toggleTaskCompletion}
                                  updateTaskDuration={updateTaskDuration}
                                  updateTaskPriority={updateTaskPriority}
                                  moveTask={moveTask}
                                  updateTaskField={updateTaskField}
                                  deleteTask={deleteTask}
                                />
                              ))}
                              {day.tasks.length === 0 && (
                                <div className="p-6 text-center text-muted-foreground text-sm italic">
                                  Rest day or no tasks scheduled.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </MagicCard>
                    )})}
                  </MagicCardContainer>
                </div>
              </>
            ) : studyPlans.length > 0 ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">Your Study Plans</h2>
                <MagicCardContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studyPlans.map(plan => (
                    <MagicCard 
                      key={plan.id} 
                      className="cursor-pointer hover:border-primary transition-colors bg-card text-card-foreground border rounded-xl shadow-sm"
                      onClick={() => setActivePlanId(plan.id)}
                      enableTilt={true}
                      enableMagnetism={true}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg">{plan.title}</CardTitle>
                        <CardDescription>Generated on {format(new Date(plan.createdAt), "MMM d, yyyy h:mm a")}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {plan.plan.length} days
                          </div>
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            {plan.plan.reduce((acc, day) => acc + day.tasks.length, 0)} tasks
                          </div>
                        </div>
                      </CardContent>
                    </MagicCard>
                  ))}
                </MagicCardContainer>
              </div>
            ) : (
              <MagicCardContainer className="h-full min-h-[400px]">
                <MagicCard 
                  className="h-full w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl p-8 text-center bg-card"
                  enableTilt={false}
                  enableMagnetism={false}
                >
                  <CalendarIcon className="h-12 w-12 mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No Plan Generated Yet</h3>
                  <p className="max-w-sm">Fill out your constraints and syllabus on the left, then click generate to create your adaptive study plan.</p>
                </MagicCard>
              </MagicCardContainer>
            )}
          </div>
        </div>
      </div>
      </motion.div>
      )}
      
      {!showSplash && (
        <div className="mt-12 pb-8 no-print">
          <ScrollVelocity
            texts={['MADE BY TEAM 07 GDG ITER', 'SMART STUDY PLANNER']}
            velocity={50}
            className="text-4xl sm:text-6xl font-bold text-muted-foreground/20 dark:text-muted-foreground/10"
          />
        </div>
      )}
      
      <Toaster />
    </>
  );
}

function TaskRow({
  task,
  dayIndex,
  taskIndex,
  planDates,
  currentDate,
  toggleTaskCompletion,
  updateTaskDuration,
  updateTaskPriority,
  moveTask,
  updateTaskField,
  deleteTask
}: {
  key?: React.Key;
  task: Task;
  dayIndex: number;
  taskIndex: number;
  planDates: { date: string; formatted: string }[];
  currentDate: string;
  toggleTaskCompletion: (d: number, t: number) => void;
  updateTaskDuration: (d: number, t: number, dur: number) => void;
  updateTaskPriority: (d: number, t: number, p: "high"|"medium"|"low") => void;
  moveTask: (d: number, t: number, date: string) => void;
  updateTaskField: (d: number, t: number, field: keyof Task, val: any) => void;
  deleteTask: (d: number, t: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = () => {
    setIsEditing(false);
    toast.success("Changes saved successfully", {
      description: `${task.subject}: ${task.topic}`,
      duration: 2000,
    });
  };

  return (
    <div className={cn(
      "p-4 flex flex-col sm:flex-row items-start gap-4 transition-colors",
      task.completed 
        ? "bg-muted/30 opacity-75" 
        : task.type === "revision" 
          ? "bg-purple-500/5 dark:bg-purple-500/10" 
          : "bg-blue-500/5 dark:bg-blue-500/10"
    )}>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <Checkbox 
          checked={!!task.completed} 
          onCheckedChange={() => toggleTaskCompletion(dayIndex, taskIndex)} 
          className="no-print mt-1"
        />
        <div className={cn(
          "w-2 h-8 rounded-full shrink-0 mt-1",
          task.type === "revision" ? "bg-purple-400" : "bg-blue-400"
        )} />
      </div>

      <div className="flex-1 space-y-2 w-full">
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Input 
                value={task.subject} 
                onChange={(e) => updateTaskField(dayIndex, taskIndex, "subject", e.target.value)} 
                className="h-8 text-sm font-semibold flex-1 min-w-[120px] bg-background"
                placeholder="Subject"
              />
              <Select value={task.type} onValueChange={(val) => updateTaskField(dayIndex, taskIndex, "type", val)}>
                <SelectTrigger className="h-8 text-xs w-[120px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="study">Study</SelectItem>
                  <SelectItem value="revision">Revision</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input 
              value={task.topic} 
              onChange={(e) => updateTaskField(dayIndex, taskIndex, "topic", e.target.value)} 
              className="h-8 text-sm bg-background"
              placeholder="Topic"
            />
            <Textarea
              value={task.description || ""}
              onChange={(e) => updateTaskField(dayIndex, taskIndex, "description", e.target.value)}
              className="text-sm min-h-[60px] bg-background"
              placeholder="Brief description of what to study..."
            />
            <div className="flex flex-wrap gap-2">
              <Input 
                value={task.referenceName || ""} 
                onChange={(e) => updateTaskField(dayIndex, taskIndex, "referenceName", e.target.value)} 
                className="h-8 text-xs flex-1 min-w-[120px] bg-background"
                placeholder="Resource Name (e.g. Khan Academy)"
              />
              <Input 
                value={task.referenceUrl || ""} 
                onChange={(e) => updateTaskField(dayIndex, taskIndex, "referenceUrl", e.target.value)} 
                className="h-8 text-xs flex-[2] min-w-[200px] bg-background"
                placeholder="Resource URL (https://...)"
              />
            </div>
          </div>
        ) : (
          <div 
            className="cursor-pointer group" 
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={cn("font-semibold text-foreground", task.completed && "line-through")}>{task.subject}</span>
              <span className={cn(
                "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                task.type === "revision" ? "bg-purple-500/10 text-purple-700 dark:text-purple-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
              )}>
                {task.type === "revision" ? <RefreshCw className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                {task.type}
              </span>
              <span className={cn(
                "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full",
                task.priority === "high" ? "bg-red-500/10 text-red-700 dark:text-red-400" : 
                task.priority === "medium" ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : 
                "bg-green-500/10 text-green-700 dark:text-green-400"
              )}>
                {task.priority || "medium"}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <p className={cn("text-muted-foreground text-sm font-medium", task.completed && "line-through")}>{task.topic}</p>
            
            {isExpanded && (
              <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {task.description && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className={cn("text-sm leading-relaxed", task.completed && "opacity-50 line-through")}>
                      {task.description}
                    </p>
                  </div>
                )}
                
                {task.referenceUrl && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={task.referenceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline",
                        task.completed && "opacity-50"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.referenceName || task.referenceUrl}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(showNotes || (isExpanded && task.notes)) && (
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
            <Textarea 
              placeholder="Add your notes here..." 
              value={task.notes || ""} 
              onChange={(e) => updateTaskField(dayIndex, taskIndex, "notes", e.target.value)}
              className="text-sm min-h-[80px] bg-background"
            />
          </div>
        )}
        
        <div className="flex gap-2 pt-2 no-print border-t mt-3 border-border/50">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setShowNotes(!showNotes)}>
            <FileText className="h-3 w-3 mr-1" /> {showNotes ? "Hide Notes" : "Add Notes"}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-7 px-2 text-xs transition-all duration-200",
              isEditing ? "text-primary font-bold" : "text-muted-foreground"
            )} 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            {isEditing ? <Save className="h-3 w-3 mr-1" /> : <Edit2 className="h-3 w-3 mr-1" />}
            {isEditing ? "Save" : "Edit"}
          </Button>

          <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
            <DialogTrigger render={
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive ml-auto">
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Task</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this task? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-semibold">{task.subject}</p>
                  <p className="text-muted-foreground">{task.topic}</p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Cancel</Button>} />
                <Button variant="destructive" onClick={() => {
                  deleteTask(dayIndex, taskIndex);
                  setIsDeleting(false);
                }}>
                  Delete Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 mt-2 sm:mt-0 no-print">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
          <Clock className="h-4 w-4" />
          <Input 
            type="number" 
            min={0.5} 
            step={0.5} 
            className="w-16 h-7 text-xs px-2 bg-background" 
            value={task.durationHours} 
            onChange={(e) => updateTaskDuration(dayIndex, taskIndex, parseFloat(e.target.value) || 0)}
          />
          h
        </div>
        <div className="flex items-center gap-2">
          <Select value={task.priority || "medium"} onValueChange={(val: "high"|"medium"|"low") => updateTaskPriority(dayIndex, taskIndex, val)}>
            <SelectTrigger className="h-7 text-xs w-[90px] bg-background">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currentDate} onValueChange={(newDate) => moveTask(dayIndex, taskIndex, newDate)}>
            <SelectTrigger className="h-7 text-xs w-[110px] bg-background">
              <SelectValue placeholder="Move to..." />
            </SelectTrigger>
            <SelectContent>
              {planDates.map(d => (
                <SelectItem key={d.date} value={d.date}>
                  {d.formatted}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

