// Define interfaces for sessions and the final timetable output.
interface Session {
  id: number;
  type: "Theory" | "Lab" | "Tutorial";
  subject: string;
  batch?: number; // only defined for Lab and Tutorial sessions
  duration: number; // in hours
}

interface ScheduledSession extends Session {
  day: string;
  startTime: string; // formatted as "HH:MM"
  endTime: string;   // formatted as "HH:MM"
  room: number;
  faculty: number;
}

interface DaySchedule {
  name: string;
  totalHours: number;
  slots: ScheduledSession[];
}

interface FacultyLoad {
  facultyNumber: number;
  hours: number;
}

interface DayDistribution {
  day: string;
  hours: number;
}

interface Timetable {
  days: DaySchedule[];
  facultyLoad: FacultyLoad[];
  dayDistribution: DayDistribution[];
}

/**
 * Generate the 35 sessions:
 *   For each of 5 subjects:
 *     - 1 Theory session (2 hours)
 *     - 3 Lab sessions (2 hours each)
 *     - 3 Tutorial sessions (1 hour each)
 */
function generateSessions(): Session[] {
  const subjects = ["Math", "Physics", "Chemistry", "CS", "Biology"];
  let sessions: Session[] = [];
  let id = 1;

  for (let subject of subjects) {
    // Theory session: 2 hours, common for all batches.
    sessions.push({ id: id++, type: "Theory", subject, duration: 2 });

    // Lab sessions: 2 hours each, one per batch (3 batches)
    for (let batch = 1; batch <= 3; batch++) {
      sessions.push({ id: id++, type: "Lab", subject, batch, duration: 2 });
    }

    // Tutorial sessions: 1 hour each, one per batch (3 batches)
    for (let batch = 1; batch <= 3; batch++) {
      sessions.push({ id: id++, type: "Tutorial", subject, batch, duration: 1 });
    }
  }
  return sessions;
}

/**
 * Format a given hour (as a number) to a string "HH:00".
 */
function formatTime(hour: number): string {
  const hStr = hour < 10 ? 0 : `${hour} : ${hour}`;
  return `${hStr}:00`;
}

/**
 * Given a DaySchedule, assign sequential start and end times to each session.
 * We assume the day starts at 08:00, has a fixed break at 13:00 (of 1 hour),
 * and the sessions (which are already “packed” so the total equals 11 hours) are placed sequentially.
 */
function assignTimeSlots(daySchedule: DaySchedule, breakHour: number, dayStart: number): void {
  let currentTime = dayStart;
  for (let session of daySchedule.slots) {
    // If the session would cross the break, skip the break hour.
    if (currentTime < breakHour && (currentTime + session.duration) > breakHour) {
      currentTime = breakHour + 1; // jump past the break (assume break is 1 hour)
    }
    // If exactly at the break hour, then skip it.
    if (currentTime === breakHour) {
      currentTime = breakHour + 1;
    }
    session.startTime = formatTime(currentTime);
    session.endTime = formatTime(currentTime + session.duration);
    currentTime += session.duration;
  }
}

/**
 * This function builds a timetable with a fixed, “balanced” distribution:
 *
 * • Each day (Monday–Friday) gets exactly 11 hours:
 *     – 1 Theory (2 hrs), 3 Labs (3×2 = 6 hrs) and 3 Tutorials (3×1 = 3 hrs).
 *
 * • The sessions are assigned in a round-robin (by type) to the 5 days.
 *
 * • Then each session is given a start time (with a break at 13:00), plus a room
 *   (using round-robin among available rooms) and a faculty (assigned by always picking
 *   the faculty with the lowest current load).
 */
export function generateTimetable(numFaculty: number, numRooms: number): Timetable {
  const sessions = generateSessions();

  // Partition sessions into their types.
  const theorySessions = sessions.filter(s => s.type === "Theory");
  const labSessions = sessions.filter(s => s.type === "Lab");
  const tutorialSessions = sessions.filter(s => s.type === "Tutorial");

  // For consistency, sort each category by subject.
  theorySessions.sort((a, b) => a.subject.localeCompare(b.subject));
  labSessions.sort((a, b) => a.subject.localeCompare(b.subject));
  tutorialSessions.sort((a, b) => a.subject.localeCompare(b.subject));

  // There are 5 days – we want each day to have:
  //   • 1 theory (2 hours)
  //   • 3 labs (3 × 2 = 6 hours)
  //   • 3 tutorials (3 × 1 = 3 hours)
  // Total = 11 hours.
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const daySchedules: DaySchedule[] = dayNames.map(day => ({
    name: day,
    totalHours: 11,
    slots: []
  }));

  // Assign the 5 theory sessions – one per day.
  theorySessions.forEach((session, index) => {
    const dayIndex = index % 5;
    daySchedules[dayIndex].slots.push({
      ...session,
      day: daySchedules[dayIndex].name,
      startTime: "",
      endTime: "",
      room: 0,
      faculty: 0
    });
  });

  // There are 15 lab sessions – assign them round-robin so that each day gets 3 labs.
  labSessions.forEach((session, index) => {
    const dayIndex = index % 5;
    daySchedules[dayIndex].slots.push({
      ...session,
      day: daySchedules[dayIndex].name,
      startTime: "",
      endTime: "",
      room: 0,
      faculty: 0
    });
  });

  // There are 15 tutorial sessions – assign them round-robin so that each day gets 3 tutorials.
  tutorialSessions.forEach((session, index) => {
    const dayIndex = index % 5;
    daySchedules[dayIndex].slots.push({
      ...session,
      day: daySchedules[dayIndex].name,
      startTime: "",
      endTime: "",
      room: 0,
      faculty: 0
    });
  });

  // (Optional) Sort each day’s sessions in a consistent order.
  daySchedules.forEach(day => {
    day.slots.sort((a, b) => {
      // For example: first by subject, then by type (Theory < Lab < Tutorial)
      const typeOrder: { [key: string]: number } = { "Theory": 1, "Lab": 2, "Tutorial": 3 };
      if (a.subject === b.subject) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      return a.subject.localeCompare(b.subject);
    });
  });

  // For each day, assign start/end times.
  // Assume the day starts at 08:00 and that there is a 1-hour break at 13:00.
  daySchedules.forEach(day => {
    assignTimeSlots(day, 13, 8);
  });

  // Now assign faculty and rooms in a balanced way.
  // For faculty, we keep an array of loads (total hours assigned so far).
  const facultyLoads: number[] = new Array(numFaculty).fill(0);
  let roomCounter = 0; // to cycle through available rooms

  daySchedules.forEach(day => {
    day.slots.forEach(session => {
      // Choose the faculty with the current minimum load.
      let minLoad = Infinity;
      let chosenFaculty = 0;
      for (let i = 0; i < numFaculty; i++) {
        if (facultyLoads[i] < minLoad) {
          minLoad = facultyLoads[i];
          chosenFaculty = i;
        }
      }
      session.faculty = chosenFaculty + 1; // faculty numbers are 1-indexed
      facultyLoads[chosenFaculty] += session.duration;

      // Assign room in a round-robin manner.
      session.room = (roomCounter % numRooms) + 1;
      roomCounter++;
    });
  });

  // Build the facultyLoad summary.
  const facultyLoadArray: FacultyLoad[] = facultyLoads.map((hours, index) => ({
    facultyNumber: index + 1,
    hours
  }));

  // Build the dayDistribution summary.
  const dayDistribution: DayDistribution[] = daySchedules.map(day => ({
    day: day.name,
    hours: day.totalHours
  }));

  return {
    days: daySchedules,
    facultyLoad: facultyLoadArray,
    dayDistribution: dayDistribution
  };
}

// Example usage: generate a timetable for 10 faculties and 10 rooms.
// const timetable = generateTimetable(10, 10);
// console.log(JSON.stringify(timetable, null, 2));