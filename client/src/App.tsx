import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Edit, PlusCircle, Trash } from "lucide-react"
import { useState } from "react"
import { exportToPDF, getCellStyle } from "./helpers"

interface Room {
  roomNumber: number;
  isEmpty: boolean;
  courseCode?: string;
  courseName?: string;
  batch?: number | string;
  faculty?: number;
  isLab?: boolean;
}

interface TimeSlot {
  time: string;
  isLunch: boolean;
  rooms: Room[];
}

interface Day {
  name: string;
  totalHours: number;
  slots: TimeSlot[];
}

interface Timetable {
  days: Day[];
}

interface TimetableResponse {
  success: boolean;
  message: string;
  timetable: Timetable;
}

export default function TimetableGenerator() {
  const [step, setStep] = useState(1)
  const [facultyCount, setFacultyCount] = useState(0)
  const [faculties, setFaculties] = useState<string[]>([])
  const [roomCount, setRoomCount] = useState(0)
  const [rooms, setRooms] = useState<string[]>([])
  const [timetable, setTimetable] = useState<Timetable | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFacultyCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = Number.parseInt(e.target.value) || 0;
    setFacultyCount(count);
    setFaculties(Array.from({ length: count }, (_, i) => `F${i + 1}`));
  };
  
  const handleRoomCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = Number.parseInt(e.target.value) || 0;
    setRoomCount(count);
    setRooms(Array.from({ length: count }, (_, i) => `R${i + 1}`));
  };
  
  const updateFaculty = (index: number, value: string) => {
    const newFaculties = [...faculties]
    newFaculties[index] = value
    setFaculties(newFaculties)
  }

  const updateRoom = (index: number, value: string) => {
    const newRooms = [...rooms]
    newRooms[index] = value
    setRooms(newRooms)
  }

  const addFaculty = () => {
    setFacultyCount(prev => prev + 1);
    setFaculties(prev => [...prev, `F${prev.length + 1}`]);
  }

  const removeFaculty = (index: number) => {
    const newFaculties = [...faculties];
    newFaculties.splice(index, 1);
    setFaculties(newFaculties);
    setFacultyCount(prev => prev - 1);
  }

  const addRoom = () => {
    setRoomCount(prev => prev + 1);
    setRooms(prev => [...prev, `R${prev.length + 1}`]);
  }

  const removeRoom = (index: number) => {
    const newRooms = [...rooms];
    newRooms.splice(index, 1);
    setRooms(newRooms);
    setRoomCount(prev => prev - 1);
  }

  const generateTimetable = async () => {
    setLoading(true)

    try {
      const response = await fetch("http://localhost:3000/api/timetable/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numFaculty: faculties.length,
          numRooms: rooms.length,
          facultyNames: faculties,
          roomNames: rooms
        }),
      })

      const data: TimetableResponse = await response.json()

      if (data.success) {
        setTimetable(data.timetable)
        setStep(3)
      } else {
        console.error("Error generating timetable:", data.message)
      }
    } catch (error) {
      console.error("Failed to fetch timetable:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatSlotContent = (room: Room) => {
    if (room.isEmpty) return ""
    
    const content = []
    
    if (room.courseCode) {
      content.push(`<div class="font-semibold text-sm">${room.courseCode}</div>`)
    }
    
    if (room.courseName) {
      content.push(`<div class="text-sm mb-1">${room.courseName}</div>`)
    }
    
    if (room.faculty !== undefined && faculties[room.faculty - 1]) {
      content.push(`<div class="text-xs text-gray-700 font-medium">Faculty: ${faculties[room.faculty - 1]}</div>`)
    }
    
    if (room.batch !== undefined) {
      if (typeof room.batch === 'string' && room.batch.toLowerCase() === 'all') {
        content.push(`<div class="text-xs text-gray-700">Batch: All</div>`)
      } else {
        content.push(`<div class="text-xs text-gray-700">Batch: ${room.batch}</div>`)
      }
    }
    
    return `<div class="flex flex-col h-full">${content.join("")}</div>`
  }

  const dayColors = {
    "Monday": "bg-blue-50 text-blue-800",
    "Tuesday": "bg-green-50 text-green-800",
    "Wednesday": "bg-purple-50 text-purple-800",
    "Thursday": "bg-amber-50 text-amber-800",
    "Friday": "bg-rose-50 text-rose-800",
    "Saturday": "bg-emerald-50 text-emerald-800",
    "Sunday": "bg-indigo-50 text-indigo-800",
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">Timetable Generator</h1>

      <Tabs value={`step-${step}`} className="max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="step-1" onClick={() => setStep(1)}>
            Faculty & Rooms
          </TabsTrigger>
          <TabsTrigger value="step-2" onClick={() => (faculties.length > 0 && rooms.length > 0 ? setStep(2) : null)}>
            Details
          </TabsTrigger>
          <TabsTrigger value="step-3" onClick={() => (timetable ? setStep(3) : null)}>
            Generated Timetable
          </TabsTrigger>
        </TabsList>

        <TabsContent value="step-1">
          <Card className="border-t-4 border-t-blue-500 shadow-md">
            <CardHeader>
              <CardTitle className="text-blue-700">Step 1: Enter Faculty and Room Information</CardTitle>
              <CardDescription>Specify the number of faculties and rooms for your timetable</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Faculties</h3>
                  <Button variant="outline" size="sm" onClick={addFaculty} className="gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Add Faculty
                  </Button>
                </div>

                {faculties.length > 0 ? (
                  <div className="grid gap-3">
                    {faculties.map((faculty, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                        <Input
                          placeholder={`Faculty ${index + 1}`}
                          value={faculty}
                          onChange={(e) => updateFaculty(index, e.target.value)}
                          className="flex-1 border-blue-200 focus:border-blue-500"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeFaculty(index)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed rounded-lg bg-slate-50">
                    <p className="text-slate-500">No faculties added yet.</p>
                    <Button variant="outline" size="sm" onClick={addFaculty} className="mt-2 gap-1">
                      <PlusCircle className="h-4 w-4" />
                      Add Faculty
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Rooms</h3>
                  <Button variant="outline" size="sm" onClick={addRoom} className="gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Add Room
                  </Button>
                </div>

                {rooms.length > 0 ? (
                  <div className="grid gap-3">
                    {rooms.map((room, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        <div className="bg-amber-100 text-amber-700 w-8 h-8 rounded-full flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                        <Input
                          placeholder={`Room ${index + 1}`}
                          value={room}
                          onChange={(e) => updateRoom(index, e.target.value)}
                          className="flex-1 border-amber-200 focus:border-amber-500"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeRoom(index)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed rounded-lg bg-slate-50">
                    <p className="text-slate-500">No rooms added yet.</p>
                    <Button variant="outline" size="sm" onClick={addRoom} className="mt-2 gap-1">
                      <PlusCircle className="h-4 w-4" />
                      Add Room
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => setStep(2)} 
                disabled={!faculties.length || !rooms.length}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next Step
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="step-2">
          <Card className="border-t-4 border-t-green-500 shadow-md">
            <CardHeader>
              <CardTitle className="text-green-700">Step 2: Review and Generate</CardTitle>
              <CardDescription>Review your information and generate the timetable</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <h3 className="text-lg font-medium mb-3 text-blue-700 flex items-center">
                    <Edit className="h-4 w-4 mr-2" />
                    Faculties ({faculties.length})
                  </h3>
                  <div className="space-y-2">
                    {faculties.map((faculty, index) => (
                      <div key={index} className="flex items-center p-2 bg-white rounded border border-blue-100 shadow-sm">
                        <div className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center font-medium text-xs mr-2">
                          {index + 1}
                        </div>
                        <span>{faculty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <h3 className="text-lg font-medium mb-3 text-amber-700 flex items-center">
                    <Edit className="h-4 w-4 mr-2" />
                    Rooms ({rooms.length})
                  </h3>
                  <div className="space-y-2">
                    {rooms.map((room, index) => (
                      <div key={index} className="flex items-center p-2 bg-white rounded border border-amber-100 shadow-sm">
                        <div className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center font-medium text-xs mr-2">
                          {index + 1}
                        </div>
                        <span>{room}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                onClick={generateTimetable} 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? "Generating..." : "Generate Timetable"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="step-3">
          <Card className="border-t-4 border-t-purple-500 shadow-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-purple-700">Generated Timetable</CardTitle>
                <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1">
                  <Download className="h-4 w-4" />
                  Export as PDF
                </Button>
              </div>
              <CardDescription>Your timetable has been generated based on your inputs</CardDescription>
            </CardHeader>
            <CardContent>
              {timetable && (
                <div id="timetable-container" className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="flex items-center rounded px-3 py-1 bg-green-50 border border-green-200">
                        <div className="w-3 h-3 border-l-3 border-green-500 mr-2"></div>
                        <span className="text-xs font-medium text-green-700">Theory</span>
                      </div>
                      <div className="flex items-center rounded px-3 py-1 bg-purple-50 border border-purple-200">
                        <div className="w-3 h-3 border-l-3 border-purple-500 mr-2"></div>
                        <span className="text-xs font-medium text-purple-700">Theory (All Batches)</span>
                      </div>
                      <div className="flex items-center rounded px-3 py-1 bg-blue-50 border border-blue-200">
                        <div className="w-3 h-3 border-l-3 border-blue-500 mr-2"></div>
                        <span className="text-xs font-medium text-blue-700">Lab</span>
                      </div>
                      <div className="flex items-center rounded px-3 py-1 bg-amber-50 border border-amber-200">
                        <div className="w-3 h-3 bg-amber-200 mr-2"></div>
                        <span className="text-xs font-medium text-amber-700">Lunch</span>
                      </div>
                    </div>
                    
                    {timetable.days.map((day) => (
                      <div key={day.name} className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 py-2 px-4 rounded-lg inline-block ${dayColors[day.name as keyof typeof dayColors] || "bg-gray-100 text-gray-800"}`}>
                          {day.name}
                        </h3>
                        <div className="border rounded-lg overflow-hidden shadow-sm">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="p-3 text-left border-b">Time / Room</th>
                                {rooms.map((room, index) => (
                                  <th key={index} className="p-3 text-left border-b border-l">
                                    <div className="flex items-center">
                                      <div className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center font-medium text-xs mr-2">
                                        {index + 1}
                                      </div>
                                      Room {room}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {day.slots.map((slot, slotIndex) => (
                                <tr key={slot.time} className={slotIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className={`p-3 font-medium border-r ${slot.isLunch ? "bg-amber-100" : ""}`}>
                                    {slot.time}
                                    {slot.isLunch && <div className="text-xs font-medium text-amber-700 mt-1">LUNCH BREAK</div>}
                                  </td>
                                  {slot.rooms.map((room, roomIndex) => (
                                    <td 
                                      key={roomIndex} 
                                      className={`p-3 border-l ${getCellStyle(room, slot.isLunch)}`}
                                      dangerouslySetInnerHTML={{ __html: slot.isLunch ? 
                                        "<div class='text-amber-700 font-medium'>LUNCH BREAK</div>" : 
                                        formatSlotContent(room)
                                      }}
                                    />
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => setStep(2)}>
                Back to Details
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}