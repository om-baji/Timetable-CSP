import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"

export interface Room {
  roomNumber: number;
  isEmpty: boolean;
  courseCode?: string;
  courseName?: string;
  batch?: number | string;
  faculty?: number;
  isLab?: boolean;
}

export const exportToPDF = async () => {
  const element = document.getElementById("timetable-container")
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    logging: false,
    useCORS: true,
  })

  const imgData = canvas.toDataURL("image/png")
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  const imgProps = pdf.getImageProperties(imgData)
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
  pdf.save("timetable.pdf")
}

export const getCellStyle = (room: Room, isLunch: boolean) => {
  if (isLunch) {
    return "bg-amber-100 font-medium";
  }
  if (room.isEmpty) {
    return "text-gray-500 italic";
  }
  if (room.isLab) {
    return "bg-blue-50 border-l-4 border-blue-400";
  }
  if (room.batch === "ALL") {
    return "bg-purple-50 border-l-4 border-purple-400";
  }
  return "bg-green-50 border-l-4 border-green-400"; // Regular theory class
}

export const formatSlotContent = (room: Room) => {
  if (room.isEmpty) {
    return "Free";
  }

  const batchInfo = room.batch === "ALL" ? "All Batches" : `Batch ${room.batch}`;
  return (
    <div>
      <div className="font-medium">{room.courseCode} - {room.courseName}</div>
      <div className="text-xs">{batchInfo} • Faculty {room.faculty}</div>
      {room.isLab && <div className="text-xs font-medium text-blue-600">Lab Session</div>}
      {room.batch === "ALL" && <div className="text-xs font-medium text-purple-600">Theory Lecture</div>}
    </div>
  );
}