const DAYS = 5;
const TIME_SLOTS = 10;
const COURSES = 5;
const BATCHES = 3;
const LUNCH_SLOT = 4;

interface Session {
    courseCode: string;
    courseName: string;
    batch: number;
    faculty: number;
    isLab: boolean;

    isEmpty(): boolean;
}

class SessionImpl implements Session {
    courseCode: string = '';
    courseName: string = '';
    batch: number = -1;
    faculty: number = -1;
    isLab: boolean = false;

    isEmpty(): boolean {
        return this.courseCode === '';
    }

    static createEmpty(): Session {
        return new SessionImpl();
    }
}

interface TimeSlot {
    day: number;
    slot: number;
    room: number;

    toString(): string;
}

class TimeSlotImpl implements TimeSlot {
    day: number;
    slot: number;
    room: number;

    constructor(day: number, slot: number, room: number) {
        this.day = day;
        this.slot = slot;
        this.room = room;
    }

    compareTo(other: TimeSlot): number {
        if (this.day !== other.day) return this.day - other.day;
        if (this.slot !== other.slot) return this.slot - other.slot;
        return this.room - other.room;
    }

    toString(): string {
        return `D${this.day}T${this.slot}R${this.room}`;
    }
}

interface CourseRequirement {
    courseCode: string;
    courseName: string;
    theoryHours: number;
    labHoursPerBatch: number;
    tutorialHoursPerBatch: number;
}

interface Assignment {
    timeSlot: TimeSlot;
    session: Session;
}

export class TimeTableGraphColoring {
    private numRooms: number;
    private numFaculty: number;
    private courseRequirements: CourseRequirement[];

    private timetable: Session[][][];

    private facultyBusy: boolean[][][];
    private batchBusy: boolean[][][];
    private roomBusy: boolean[][];
    private batchLabsPerDay: boolean[][];

    private facultyLoad: number[];
    private slotsUsedPerDay: number[];

    private assignments: Assignment[];
    private courseNames: Map<string, string>;
    private conflictGraph: Map<string, Set<string>>; // Vertex: CourseRequirement, Edge: Conflict

    constructor(rooms: number, faculty: number, customCourses?: CourseRequirement[]) {
        this.numRooms = rooms;
        this.numFaculty = faculty;
        this.courseRequirements = [];
        this.timetable = [];
        this.facultyBusy = [];
        this.batchBusy = [];
        this.roomBusy = [];
        this.batchLabsPerDay = [];
        this.facultyLoad = [];
        this.slotsUsedPerDay = [];
        this.assignments = [];
        this.courseNames = new Map();
        this.conflictGraph = new Map();

        if (customCourses) {
            this.courseRequirements = customCourses;
            for (const course of customCourses) {
                this.courseNames.set(course.courseCode, course.courseName);
            }
        } else {
            this.initializeCourses();
        }

        this.initialize();
        this.buildConflictGraph();
    }

    private initializeCourses(): void {
        this.courseNames.set("ML2001", "OS");
        this.courseNames.set("ML2002", "DBMS");
        this.courseNames.set("ML2003", "DS");
        this.courseNames.set("ML2004", "CN");
        this.courseNames.set("ML2005", "ML");

        this.courseRequirements = [
            {courseCode: "ML2001", courseName: "OS", theoryHours: 2, labHoursPerBatch: 2, tutorialHoursPerBatch: 1},
            {courseCode: "ML2002", courseName: "DBMS", theoryHours: 2, labHoursPerBatch: 2, tutorialHoursPerBatch: 1},
            {courseCode: "ML2003", courseName: "DS", theoryHours: 2, labHoursPerBatch: 2, tutorialHoursPerBatch: 1},
            {courseCode: "ML2004", courseName: "CN", theoryHours: 2, labHoursPerBatch: 2, tutorialHoursPerBatch: 1},
            {courseCode: "ML2005", courseName: "ML", theoryHours: 2, labHoursPerBatch: 2, tutorialHoursPerBatch: 1}
        ];
    }

    private initialize(): void {
        this.timetable = Array(DAYS).fill(null).map(() =>
            Array(TIME_SLOTS).fill(null).map(() =>
                Array(this.numRooms).fill(null).map(() => SessionImpl.createEmpty())
            )
        );

        this.facultyBusy = Array(this.numFaculty).fill(null).map(() =>
            Array(DAYS).fill(null).map(() => {
                const daySlots = Array(TIME_SLOTS).fill(false);
                daySlots[LUNCH_SLOT] = true;
                return daySlots;
            })
        );

        this.batchBusy = Array(BATCHES).fill(null).map(() =>
            Array(DAYS).fill(null).map(() => {
                const daySlots = Array(TIME_SLOTS).fill(false);
                daySlots[LUNCH_SLOT] = true;
                return daySlots;
            })
        );

        this.roomBusy = Array(DAYS * TIME_SLOTS).fill(null).map((_, dt) => {
            const roomSlots = Array(this.numRooms).fill(false);
            if (dt % TIME_SLOTS === LUNCH_SLOT) {
                roomSlots.fill(true);
            }
            return roomSlots;
        });

        this.batchLabsPerDay = Array(BATCHES).fill(null).map(() =>
            Array(DAYS).fill(false)
        );

        this.facultyLoad = Array(this.numFaculty).fill(0);
        this.slotsUsedPerDay = Array(DAYS).fill(0);
        this.assignments = [];
    }

    private buildConflictGraph(): void {
      for (let i = 0; i < this.courseRequirements.length; i++) {
          const req1 = this.courseRequirements[i];
          const key1 = `${req1.courseCode}_theory`;
  
          // Initialize the set if it doesn't exist
          if (!this.conflictGraph.has(key1)) {
              this.conflictGraph.set(key1, new Set());
          }
  
          for (let b = 0; b < BATCHES; b++) {
              const labKey1 = `${req1.courseCode}_lab_${b}`;
              const tutorialKey1 = `${req1.courseCode}_tutorial_${b}`;
  
              if (!this.conflictGraph.has(labKey1)) {
                  this.conflictGraph.set(labKey1, new Set());
              }
              if (!this.conflictGraph.has(tutorialKey1)) {
                  this.conflictGraph.set(tutorialKey1, new Set());
              }
          }
  
          for (let j = i + 1; j < this.courseRequirements.length; j++) {
              const req2 = this.courseRequirements[j];
              const key2 = `${req2.courseCode}_theory`;
  
              if (!this.conflictGraph.has(key2)) {
                  this.conflictGraph.set(key2, new Set());
              }
  
              // Conflict: Same course, different type
              this.conflictGraph.get(key1)!.add(key2);
              this.conflictGraph.get(key2)!.add(key1);
  
              for (let b = 0; b < BATCHES; b++) {
                  const labKey1 = `${req1.courseCode}_lab_${b}`;
                  const tutorialKey1 = `${req1.courseCode}_tutorial_${b}`;
                  const labKey2 = `${req2.courseCode}_lab_${b}`;
                  const tutorialKey2 = `${req2.courseCode}_tutorial_${b}`;
  
                  if (!this.conflictGraph.has(labKey2)) {
                      this.conflictGraph.set(labKey2, new Set());
                  }
                  if (!this.conflictGraph.has(tutorialKey2)) {
                      this.conflictGraph.set(tutorialKey2, new Set());
                  }
  
                  // Conflict: Same batch, different courses
                  this.conflictGraph.get(labKey1)!.add(labKey2);
                  this.conflictGraph.get(labKey2)!.add(labKey1);
                  this.conflictGraph.get(tutorialKey1)!.add(tutorialKey2);
                  this.conflictGraph.get(tutorialKey2)!.add(tutorialKey1);
  
                  // Conflict: Same batch, lab and tutorial of the same course
                  this.conflictGraph.get(labKey1)!.add(tutorialKey1);
                  this.conflictGraph.get(tutorialKey1)!.add(labKey1);
              }
          }
      }
  }

    private isAvailable(day: number, slot: number, faculty: number, batch: number, room: number, isConsecutive: boolean = false): boolean {
        if (slot === LUNCH_SLOT) {
            return false;
        }

        if (faculty !== -1 && this.facultyBusy[faculty][day][slot]) {
            return false;
        }

        if (batch !== -1) {
            if (this.batchBusy[batch][day][slot]) {
                return false;
            }
        } else {
            for (let b = 0; b < BATCHES; b++) {
                if (this.batchBusy[b][day][slot]) {
                    return false;
                }
            }
        }

        if (this.roomBusy[day * TIME_SLOTS + slot][room]) {
            return false;
        }

        if (isConsecutive && (slot + 1 >= TIME_SLOTS || slot + 1 === LUNCH_SLOT)) {
            return false;
        }

        if (isConsecutive && batch !== -1 && this.isLabSlot(slot) && this.batchLabsPerDay[batch][day]) {
            return false;
        }

        return true;
    }

    private isLabSlot(slot: number): boolean {
        return slot % 2 === 0 && slot + 1 < TIME_SLOTS && slot + 1 !== LUNCH_SLOT;
    }

    private assignSession(assignment: Assignment): void {
        const day = assignment.timeSlot.day;
        const slot = assignment.timeSlot.slot;
        const room = assignment.timeSlot.room;
        const faculty = assignment.session.faculty;
        const batch = assignment.session.batch;
        const isLab = assignment.session.isLab;

        this.timetable[day][slot][room] = assignment.session;

        if (faculty !== -1) {
            this.facultyBusy[faculty][day][slot] = true;
            this.facultyLoad[faculty]++;
        }

        if (batch !== -1) {
            this.batchBusy[batch][day][slot] = true;
        } else {
            for (let b = 0; b < BATCHES; b++) {
                this.batchBusy[b][day][slot] = true;
            }
        }

        this.roomBusy[day * TIME_SLOTS + slot][room] = true;

        if (isLab && batch !== -1) {
            this.batchLabsPerDay[batch][day] = true;
        }

        this.slotsUsedPerDay[day]++;
        this.assignments.push(assignment);
    }

    private unassignLastSession(): void {
        if (this.assignments.length === 0) return;

        const assignment = this.assignments.pop()!;

        const day = assignment.timeSlot.day;
        const slot = assignment.timeSlot.slot;
        const room = assignment.timeSlot.room;
        const faculty = assignment.session.faculty;
        const batch = assignment.session.batch;
        const isLab = assignment.session.isLab;

        this.timetable[day][slot][room] = SessionImpl.createEmpty();

        if (faculty !== -1) {
            this.facultyBusy[faculty][day][slot] = false;
            this.facultyLoad[faculty]--;
        }

        if (batch !== -1) {
            this.batchBusy[batch][day][slot] = false;
        } else {
            for (let b = 0; b < BATCHES; b++) {
                this.batchBusy[b][day][slot] = false;
            }
        }

        this.roomBusy[day * TIME_SLOTS + slot][room] = false;

        if (isLab && batch !== -1) {
            let stillHasLab = false;
            for (let t = 0; t < TIME_SLOTS; t++) {
                for (let r = 0; r < this.numRooms; r++) {
                    if (!this.timetable[day][t][r].isEmpty() &&
                        this.timetable[day][t][r].batch === batch &&
                        this.timetable[day][t][r].isLab) {
                        stillHasLab = true;
                        break;
                    }
                }
                if (stillHasLab) break;
            }

            if (!stillHasLab) {
                this.batchLabsPerDay[batch][day] = false;
            }
        }

        this.slotsUsedPerDay[day]--;
    }

    private getLeastLoadedFaculty(): number {
        let minLoad = Number.MAX_SAFE_INTEGER;
        let candidates: number[] = [];

        for (let f = 0; f < this.numFaculty; f++) {
            if (this.facultyLoad[f] < minLoad) {
                minLoad = this.facultyLoad[f];
                candidates = [f];
            } else if (this.facultyLoad[f] === minLoad) {
                candidates.push(f);
            }
        }

        if (candidates.length > 0) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        return 0;
    }

    private getValidTimeSlots(courseCode: string, faculty: number, batch: number, isLab: boolean): TimeSlot[] {
        const validSlots: TimeSlot[] = [];

        for (let d = 0; d < DAYS; d++) {
            if (isLab && batch !== -1 && this.batchLabsPerDay[batch][d]) {
                continue;
            }

            for (let t = 0; t < TIME_SLOTS; t++) {
                if (isLab || (batch === -1 && t < TIME_SLOTS - 1 && t + 1 !== LUNCH_SLOT)) {
                    if (t === LUNCH_SLOT || (t + 1 === LUNCH_SLOT)) {
                        continue;
                    }

                    for (let r = 0; r < this.numRooms; r++) {
                        if (this.isAvailable(d, t, faculty, batch, r, true) &&
                            this.isAvailable(d, t + 1, faculty, batch, r)) {
                            validSlots.push(new TimeSlotImpl(d, t, r));
                        }
                    }
                }
                else if (batch !== -1 && t !== LUNCH_SLOT) {
                    for (let r = 0; r < this.numRooms; r++) {
                        if (this.isAvailable(d, t, faculty, batch, r)) {
                            validSlots.push(new TimeSlotImpl(d, t, r));
                        }
                    }
                }
            }
        }

        validSlots.sort((a, b) => {
            if (this.slotsUsedPerDay[a.day] !== this.slotsUsedPerDay[b.day]) {
                return this.slotsUsedPerDay[a.day] - this.slotsUsedPerDay[b.day];
            }
            if (a.day !== b.day) return a.day - b.day;
            if (a.slot !== b.slot) return a.slot - b.slot;
            return a.room - b.room;
        });

        return validSlots;
    }

    private scheduleRequirement(courseCode: string, courseName: string,
                                faculty: number, batch: number, isLab: boolean, duration: number): boolean {
        const validSlots = this.getValidTimeSlots(courseCode, faculty, batch, isLab);

        for (const timeSlot of validSlots) {
            const session = new SessionImpl();
            session.courseCode = courseCode;
            session.courseName = courseName;
            session.faculty = faculty;
            session.batch = batch;
            session.isLab = isLab;

            const assignment: Assignment = {
                timeSlot,
                session
            };

            this.assignSession(assignment);

            if (isLab || batch === -1) {
                const nextSlot = new TimeSlotImpl(timeSlot.day, timeSlot.slot + 1, timeSlot.room);
                const nextAssignment: Assignment = {
                    timeSlot: nextSlot,
                    session
                };
                this.assignSession(nextAssignment);
            }

            return true;
        }

        return false;
    }

    private colorGraph(requirements: [string, string, number, number, boolean, number][]): boolean {
        const assignmentMap: Map<string, { faculty: number; timeSlot: TimeSlot }> = new Map();
        const sortedRequirements = [...requirements];

        // Sort requirements based on the number of constraints (degree in the conflict graph)
        sortedRequirements.sort((a, b) => {
            const keyA = `<span class="math-inline">\{a\[0\]\}\_</span>{a[4] ? 'lab' : (a[3] === -1 ? 'theory' : ' 'tutorial')}_${a[3]}`;
            const keyB = `${b[0]}_${b[4] ? 'lab' : (b[3] === -1 ? 'theory' : 'tutorial')}_${b[3]}`;
            const degreeA = this.conflictGraph.get(keyA)?.size ?? 0;
            const degreeB = this.conflictGraph.get(keyB)?.size ?? 0;
            return degreeB - degreeA;
        });

        for (const req of sortedRequirements) {
            const [courseCode, courseName, , batch, isLab, ] = req;
            const key = `${courseCode}_${isLab ? 'lab' : (batch === -1 ? 'theory' : 'tutorial')}_${batch}`;
            let assigned = false;

            // Try assigning with the least loaded faculty
            const faculty = this.getLeastLoadedFaculty();
            if (this.scheduleRequirement(courseCode, courseName, faculty, batch, isLab, isLab ? 2 : 1)) {
                assignmentMap.set(key, { faculty, timeSlot: this.assignments[this.assignments.length - 1].timeSlot });
                assigned = true;
            }

            if (!assigned) {
                // Backtrack if assignment fails (though coloring should theoretically prevent this)
                console.error(`Failed to assign requirement: ${key}`);
                // Implement backtracking or a more robust conflict resolution here if needed
                return false;
            }
        }
        return true;
    }

    public generateTimetable(): boolean {
        const requirements = this.generateRequirements();
        return this.colorGraph(requirements);
    }

    private generateRequirements(): [string, string, number, number, boolean, number][] {
        const requirements: [string, string, number, number, boolean, number][] = [];

        for (const course of this.courseRequirements) {
            requirements.push([
                course.courseCode, course.courseName, -1, -1, false, course.theoryHours
            ]);

            for (let b = 0; b < BATCHES; b++) {
                requirements.push([
                    course.courseCode, course.courseName, -1, b, true, course.labHoursPerBatch
                ]);
            }

            for (let b = 0; b < BATCHES; b++) {
                requirements.push([
                    course.courseCode, course.courseName, -1, b, false, course.tutorialHoursPerBatch
                ]);
            }
        }

        return requirements;
    }

    public getTimetableJSON(): any {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        const result: any = {
            days: [],
            facultyLoad: [],
            dayDistribution: []
        };

        for (let d = 0; d < DAYS; d++) {
            const daySchedule: any = {
                name: days[d],
                totalHours: this.slotsUsedPerDay[d],
                slots: []
            };

            for (let t = 0; t < TIME_SLOTS; t++) {
                const slot: any = {
                    time: `${String(t + 8).padStart(2, '0')}:00-${String(t + 9).padStart(2, '0')}:00`,
                    isLunch: t === LUNCH_SLOT,
                    rooms: []
                };

                if (t === LUNCH_SLOT) {
                    for (let r = 0; r < this.numRooms; r++) {
                        slot.rooms.push({
                            roomNumber: r + 1,
                            isLunch: true
                        });
                    }
                } else {
                    for (let r = 0; r < this.numRooms; r++) {
                        if (!this.timetable[d][t][r].isEmpty()) {
                            const session = this.timetable[d][t][r];
                            slot.rooms.push({
                                roomNumber: r + 1,
                                isEmpty: false,
                                courseCode: session.courseCode,
                                courseName: session.courseName,
                                batch: session.batch !== -1 ? session.batch + 1 : "ALL",
                                faculty: session.faculty + 1,
                                isLab: session.isLab
                            });
                        } else {
                            slot.rooms.push({
                                roomNumber: r + 1,
                                isEmpty: true
                            });
                        }
                    }
                }

                daySchedule.slots.push(slot);
            }

            result.days.push(daySchedule);
        }

        for (let f = 0; f < this.numFaculty; f++) {
            result.facultyLoad.push({
                facultyNumber: f + 1,
                hours: this.facultyLoad[f]
            });
        }

        for (let d = 0; d < DAYS; d++) {
            result.dayDistribution.push({
                day: days[d],
                hours: this.slotsUsedPerDay[d]
            });
        }

        return result;
    }

    public generateTimetableWithRestarts(maxRestarts: number = 5): boolean {
        for (let attempt = 0; attempt < maxRestarts; attempt++) {
            this.initialize();
            this.buildConflictGraph();

            if (this.generateTimetable()) {
                return true;
            }
        }

        return false;
    }
}

// const numRooms : number = 7;
// const numFaculty : number = 5;
    
// const solver = new TimeTableGraphColoring(numRooms, numFaculty);

// if(solver.generateTimetableWithRestarts()) {
//   console.log(solver.getTimetableJSON())
// } else {
//   console.log("Failde");
  
// }