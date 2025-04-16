type Day = 0 | 1 | 2 | 3 | 4;
type SessionType = 'lab' | 'tutorial' | 'theory';

interface TimeSlot {
    day: Day;
    start: number;
    end: number;
}

interface Timetable {
    sessions: Map<Session, TimeSlot>;
    facultyMap: Map<string, Session[]>;
    roomMap: Map<string, Session[]>;
}

interface Session {
    id: string;
    type: SessionType;
    subject: string;
    batch?: number;
    duration: number;
    faculty: string;
    possibleSlots: TimeSlot[];
    room: string;
}

export class TimetableGenerator {
    private days: Day[] = [0, 1, 2, 3, 4];
    private breakTime = { start: 12, end: 13 };
    private collegeHours = { start: 8, end: 18 };
    private sessions: Session[] = [];
    private facultyAvailability = new Map<string, TimeSlot[]>();
    private roomAvailability = new Map<string, TimeSlot[]>();

    constructor(
        private numFaculty: number,
        private numRooms: number,
        private batches: number[]
    ) {}

    public generateTimetable(): Map<Session, TimeSlot> {
        this.initializeSessions();
        this.precomputePossibleSlots();
        return this.findMaximumMatching();
    }

    private initializeSessions(): void {
        for (let s = 1; s <= 5; s++) {
            const subject = `Subject${s}`;
            this.sessions.push({
                id: `${subject}-theory`,
                type: 'theory',
                subject,
                duration: 2,
                faculty: `FacultyTheory${s}`,
                possibleSlots: [],
                room: 'RoomTheory'
            });

            for (const batch of this.batches) {
                this.sessions.push({
                    id: `${subject}-lab-${batch}`,
                    type: 'lab',
                    subject,
                    batch,
                    duration: 2,
                    faculty: `FacultyLab${s}-${batch}`,
                    possibleSlots: [],
                    room: `RoomLab${s}`
                });

                this.sessions.push({
                    id: `${subject}-tutorial-${batch}`,
                    type: 'tutorial',
                    subject,
                    batch,
                    duration: 1,
                    faculty: `FacultyTut${s}-${batch}`,
                    possibleSlots: [],
                    room: `RoomTut${s}`
                });
            }
        }
    }

    private precomputePossibleSlots(): void {
        for (const session of this.sessions) {
            session.possibleSlots = this.calculatePossibleSlots(session);
        }
    }

    private calculatePossibleSlots(session: Session): TimeSlot[] {
        const slots: TimeSlot[] = [];
        const duration = session.duration;

        for (const day of this.days) {
            let start = this.collegeHours.start;
            while (start + duration <= this.collegeHours.end) {
                if (session.type === 'tutorial' && (start >= 17 || (start <= 12 && start + duration > 12))) {
                    start += 1;
                    continue;
                }

                const end = start + duration;
                
                if (!this.overlapsBreak(start, end)) {
                    const slot = { day, start, end };
                    if (this.isValidSlot(session, slot)) {
                        slots.push(slot);
                    }
                }
                
                start += (session.type === 'lab') ? 2 : 1;
            }
        }
        return slots;
    }

    private overlapsBreak(start: number, end: number): boolean {
        return start < this.breakTime.end && end > this.breakTime.start;
    }

    private isValidSlot(session: Session, slot: TimeSlot): boolean {
        if (slot.day === 4 && slot.start >= 16) return false;
        return this.isFacultyAvailable(session.faculty, slot) &&
               this.isRoomAvailable(session.room, slot) &&
               this.facultyFridayAvailability(session.faculty);
    }

    private isFacultyAvailable(faculty: string, slot: TimeSlot): boolean {
        return this.checkAvailability(this.facultyAvailability, faculty, slot);
    }

    private isRoomAvailable(room: string, slot: TimeSlot): boolean {
        return this.checkAvailability(this.roomAvailability, room, slot);
    }

    private checkAvailability(map: Map<string, TimeSlot[]>, key: string, slot: TimeSlot): boolean {
        const existing = map.get(key) || [];
        return !existing.some(s => this.slotsOverlap(s, slot));
    }

    private slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
        return a.day === b.day && 
               a.start < b.end && 
               a.end > b.start;
    }

    private findMaximumMatching(): Map<Session, TimeSlot> {
        const matches = new Map<Session, TimeSlot>();
        const sessionQueue = this.prioritizeSessions();

        while (sessionQueue.length > 0) {
            const session = sessionQueue.shift()!;
            const slot = this.findFirstAvailableSlot(session);
            
            if (slot) {
                this.assignSlot(session, slot);
                matches.set(session, slot);
            }
        }

        return matches;
    }

    private prioritizeSessions(): Session[] {
        return [...this.sessions].sort((a, b) => {
            const typePriority = { theory: 0, lab: 1, tutorial: 2 };
            return typePriority[a.type] - typePriority[b.type];
        });
    }

    private findFirstAvailableSlot(session: Session): TimeSlot | null {
        for (const slot of session.possibleSlots) {
            if (this.isValidSlot(session, slot)) {
                return slot;
            }
        }
        return null;
    }

    private assignSlot(session: Session, slot: TimeSlot): void {
        this.updateAvailability(this.facultyAvailability, session.faculty, slot);
        this.updateAvailability(this.roomAvailability, session.room, slot);
    }

    private updateAvailability(map: Map<string, TimeSlot[]>, key: string, slot: TimeSlot): void {
        const existing = map.get(key) || [];
        existing.push(slot);
        map.set(key, existing);
    }

    // private facultyFridayAvailability(faculty: string): boolean {
    //     return true;
    // }

    public generateFullTimetable(): Timetable {
        const sessionsMap = this.generateTimetable();
        return {
            sessions: sessionsMap,
            facultyMap: this.createFacultyMap(sessionsMap),
            roomMap: this.createRoomMap(sessionsMap)
        };
    }

    private createFacultyMap(sessions: Map<Session, TimeSlot>): Map<string, Session[]> {
        const map = new Map<string, Session[]>();
        for (const [session] of sessions) {
            const existing = map.get(session.faculty) || [];
            existing.push(session);
            map.set(session.faculty, existing);
        }
        return map;
    }

    private createRoomMap(sessions: Map<Session, TimeSlot>): Map<string, Session[]> {
        const map = new Map<string, Session[]>();
        for (const [session] of sessions) {
            const existing = map.get(session.room) || [];
            existing.push(session);
            map.set(session.room, existing);
        }
        return map;
    }

    private facultyFridayAvailability(faculty: string): boolean {
        const fridaySlots = this.facultyAvailability.get(faculty)?.filter(s => s.day === 4) || [];
        return fridaySlots.length < 2;
    }

}

