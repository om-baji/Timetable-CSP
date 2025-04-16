import express, { type Request, type Response } from "express";
import { TimeTableGraphColoring } from "./algorithms/graph";
import cors from "cors"

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get("/api/timetable", (req, res) => {
  try {
    console.log("Received request for timetable generation");
    const numRooms = 7;
    const numFaculty = 5;
    
    const solver = new TimeTableGraphColoring(numRooms, numFaculty);

    if (solver.generateTimetableWithRestarts()) {
      res.json({
        success: true,
        message: "Successfully generated timetable",
        timetable: solver.getTimetableJSON(),
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to generate a valid timetable after multiple attempts",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/timetable/custom", (req: Request, res: Response) => {
  try {
    const { numRooms, numFaculty, maxRestarts, courses } = req.body;

    if (!numRooms || !numFaculty)  throw new Error("Required parameters missing: numRooms and numFaculty are required")

    const solver = new TimeTableGraphColoring(
      parseInt(numRooms),
      parseInt(numFaculty),
      courses
    );

    if (solver.generateTimetableWithRestarts(maxRestarts || 5)) {
      res.json({
        success: true,
        message: "Successfully generated custom timetable",
        timetable: solver.getTimetableJSON(),
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to generate a valid timetable after multiple attempts",
      });
    }

    return;
  } catch (error) {
    console.error("Error generating custom timetable:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error),
    });

    return;
  }
});

app.listen(port, () => {
  console.log(`Timetable generation server running on port ${port}`);
});

export default app;
