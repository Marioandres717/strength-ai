import type { InsertExercise } from "../lib/schema"

export const exercises: Omit<InsertExercise, "id" | "createdAt">[] = [
  // Squat
  {
    name: "Back Squat",
    movement: "squat",
    primaryMuscles: ["quadriceps", "glutes", "hamstrings"],
    equipment: ["barbell", "rack"],
  },
  {
    name: "Front Squat",
    movement: "squat",
    primaryMuscles: ["quadriceps", "glutes"],
    equipment: ["barbell", "rack"],
  },
  {
    name: "Goblet Squat",
    movement: "squat",
    primaryMuscles: ["quadriceps", "glutes"],
    equipment: ["dumbbell"],
  },
  {
    name: "Leg Press",
    movement: "squat",
    primaryMuscles: ["quadriceps", "glutes"],
    equipment: ["leg press machine"],
  },
  {
    name: "Bulgarian Split Squat",
    movement: "squat",
    primaryMuscles: ["quadriceps", "glutes"],
    equipment: ["dumbbell", "bench"],
  },

  // Hinge
  {
    name: "Deadlift",
    movement: "hinge",
    primaryMuscles: ["hamstrings", "glutes", "erectors"],
    equipment: ["barbell"],
  },
  {
    name: "Romanian Deadlift",
    movement: "hinge",
    primaryMuscles: ["hamstrings", "glutes"],
    equipment: ["barbell"],
  },
  {
    name: "Hip Thrust",
    movement: "hinge",
    primaryMuscles: ["glutes"],
    equipment: ["barbell", "bench"],
  },
  {
    name: "Good Morning",
    movement: "hinge",
    primaryMuscles: ["hamstrings", "erectors"],
    equipment: ["barbell"],
  },
  {
    name: "Leg Curl (Lying)",
    movement: "hinge",
    primaryMuscles: ["hamstrings"],
    equipment: ["leg curl machine"],
  },

  // Push
  {
    name: "Barbell Bench Press",
    movement: "push",
    primaryMuscles: ["chest", "triceps", "front delts"],
    equipment: ["barbell", "bench", "rack"],
  },
  {
    name: "Incline Dumbbell Press",
    movement: "push",
    primaryMuscles: ["upper chest", "triceps", "front delts"],
    equipment: ["dumbbell", "bench"],
  },
  {
    name: "Overhead Press (Barbell)",
    movement: "push",
    primaryMuscles: ["front delts", "triceps", "upper chest"],
    equipment: ["barbell", "rack"],
  },
  {
    name: "Dumbbell Shoulder Press",
    movement: "push",
    primaryMuscles: ["front delts", "triceps"],
    equipment: ["dumbbell"],
  },
  {
    name: "Dips",
    movement: "push",
    primaryMuscles: ["chest", "triceps", "front delts"],
    equipment: ["dip station"],
  },
  {
    name: "Push-Ups",
    movement: "push",
    primaryMuscles: ["chest", "triceps", "front delts"],
    equipment: ["bodyweight"],
  },

  // Pull
  {
    name: "Pull-Ups",
    movement: "pull",
    primaryMuscles: ["lats", "biceps", "rear delts"],
    equipment: ["pull-up bar"],
  },
  {
    name: "Chin-Ups",
    movement: "pull",
    primaryMuscles: ["lats", "biceps"],
    equipment: ["pull-up bar"],
  },
  {
    name: "Barbell Row",
    movement: "pull",
    primaryMuscles: ["lats", "rhomboids", "biceps"],
    equipment: ["barbell"],
  },
  {
    name: "Seated Cable Row",
    movement: "pull",
    primaryMuscles: ["lats", "rhomboids", "biceps"],
    equipment: ["cable machine"],
  },
  {
    name: "Lat Pulldown",
    movement: "pull",
    primaryMuscles: ["lats", "biceps"],
    equipment: ["cable machine"],
  },
  {
    name: "Face Pulls",
    movement: "pull",
    primaryMuscles: ["rear delts", "rotator cuff"],
    equipment: ["cable machine"],
  },

  // Isolation
  {
    name: "Bicep Curl",
    movement: "isolation",
    primaryMuscles: ["biceps"],
    equipment: ["barbell"],
  },
  {
    name: "Hammer Curl",
    movement: "isolation",
    primaryMuscles: ["biceps", "brachialis"],
    equipment: ["dumbbell"],
  },
  {
    name: "Tricep Pushdown",
    movement: "isolation",
    primaryMuscles: ["triceps"],
    equipment: ["cable machine"],
  },
  {
    name: "Skull Crusher",
    movement: "isolation",
    primaryMuscles: ["triceps"],
    equipment: ["barbell", "bench"],
  },
  {
    name: "Lateral Raise",
    movement: "isolation",
    primaryMuscles: ["lateral delts"],
    equipment: ["dumbbell"],
  },
  {
    name: "Leg Extension",
    movement: "isolation",
    primaryMuscles: ["quadriceps"],
    equipment: ["leg extension machine"],
  },
  {
    name: "Calf Raise (Standing)",
    movement: "isolation",
    primaryMuscles: ["calves"],
    equipment: ["bodyweight"],
  },
  {
    name: "Cable Fly",
    movement: "isolation",
    primaryMuscles: ["chest"],
    equipment: ["cable machine"],
  },
  {
    name: "Reverse Fly",
    movement: "isolation",
    primaryMuscles: ["rear delts", "rhomboids"],
    equipment: ["dumbbell"],
  },
]
