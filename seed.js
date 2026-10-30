/**
 * Seed script — adds / updates "Two Sum" in MongoDB.
 * Run:  node seed.js
 *
 * IMPORTANT — stdin format used by Judge0:
 *   Line 1: JSON array   → [2,7,11,15]
 *   Line 2: target number → 9
 *
 * Each language's starterCode is a COMPLETE, self-contained script that:
 *   1. Reads stdin
 *   2. Parses the two-sum inputs
 *   3. Solves the problem
 *   4. Prints the result to stdout in the exact format expected
 *      (e.g.  [0,1]  — bracket notation, no spaces after comma)
 */
import "dotenv/config";
import connectDB from "./config/db.js";
import Problem from "./modules/problem/problem.model.js";

await connectDB();

// ─── Starter-code templates (complete runnable scripts) ───────────────────────

const JS_STARTER = `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
const nums   = JSON.parse(lines[0]);
const target = parseInt(lines[1], 10);

function twoSum(nums, target) {
  // Write your solution here
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) return [map.get(comp), i];
    map.set(nums[i], i);
  }
  return [];
}

const result = twoSum(nums, target);
console.log(JSON.stringify(result));
`;

const TS_STARTER = `import * as fs from 'fs';
const lines  = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\\n');
const nums   = JSON.parse(lines[0]) as number[];
const target = parseInt(lines[1], 10);

function twoSum(nums: number[], target: number): number[] {
  // Write your solution here
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) return [map.get(comp)!, i];
    map.set(nums[i], i);
  }
  return [];
}

const result = twoSum(nums, target);
console.log(JSON.stringify(result));
`;

const PY_STARTER = `import sys, json

data   = sys.stdin.read().strip().split('\\n')
nums   = json.loads(data[0])
target = int(data[1])

def two_sum(nums, target):
    # Write your solution here
    seen = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in seen:
            return [seen[diff], i]
        seen[n] = i
    return []

print(json.dumps(two_sum(nums, target), separators=(',', ':')))
`;

const JAVA_STARTER = `import java.util.*;
import java.io.*;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        // Write your solution here
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) return new int[]{map.get(comp), i};
            map.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line1 = br.readLine().trim();   // e.g. [2,7,11,15]
        int target   = Integer.parseInt(br.readLine().trim());

        // Parse JSON-style array manually
        line1 = line1.replaceAll("[\\\\[\\\\]\\\\s]", "");
        String[] parts = line1.split(",");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);

        int[] res = twoSum(nums, target);
        System.out.println("[" + res[0] + "," + res[1] + "]");
    }
}
`;

const CPP_STARTER = `#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Write your solution here
    unordered_map<int,int> mp;
    for (int i = 0; i < (int)nums.size(); i++) {
        int comp = target - nums[i];
        if (mp.count(comp)) return {mp[comp], i};
        mp[nums[i]] = i;
    }
    return {};
}

int main() {
    string line;
    getline(cin, line);            // "[2,7,11,15]"
    int target; cin >> target;

    // Parse JSON array
    vector<int> nums;
    stringstream ss(line);
    char c; int n;
    while (ss >> c) {
        if (c == '[' || c == ']' || c == ',') continue;
        ss.putback(c);
        ss >> n;
        nums.push_back(n);
    }

    vector<int> res = twoSum(nums, target);
    cout << "[" << res[0] << "," << res[1] << "]" << endl;
    return 0;
}
`;

// ─── Problem definition ────────────────────────────────────────────────────────
const twoSum = {
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy",
  status: "Published",
  category: "Algorithms",
  topics: ["Array", "Hash Table"],
  companies: ["Google", "Amazon", "Apple", "Meta", "Microsoft"],
  description:
    "Given an array of integers `nums` and an integer `target`, return " +
    "*indices of the two numbers such that they add up to `target`*.\n\n" +
    "You may assume that each input would have ***exactly one solution***, " +
    "and you may not use the same element twice.\n\n" +
    "You can return the answer in any order.",
  constraints: [
    "2 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9",
    "-10^9 <= target <= 10^9",
    "Only one valid answer exists.",
  ],
  examples: [
    {
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]",
      explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
    },
    {
      input: "nums = [3,2,4], target = 6",
      output: "[1,2]",
      explanation: "Because nums[1] + nums[2] == 6, we return [1, 2].",
    },
    {
      input: "nums = [3,3], target = 6",
      output: "[0,1]",
      explanation: "Because nums[0] + nums[1] == 6, we return [0, 1].",
    },
  ],
  hints: [
    "A brute force way would be to check every pair — that is O(N²). Can you do better with extra space?",
    "Try a hash map: for each number store its index, then look up (target - num) in O(1).",
  ],
  followUp: "Can you come up with an algorithm that is less than O(n²) time complexity?",
  editorial:
    "### One-Pass Hash Table\n" +
    "For each element `x`, check if `target - x` is already in the map.\n" +
    "- **Time:** O(n)  **Space:** O(n)",

  // ── stdin format: line 1 = JSON array, line 2 = target ───────────────────
  // Judge0 runs the script as-is; stdout must match expectedOutput exactly.
  testCases: [
    // ── Sample cases (visible to the user in the Test panel) ───────────────
    {
      input: "[2,7,11,15]\n9",
      expectedOutput: "[0,1]",
      isSample: true,
      weight: 10,
      explanation: "Basic case — first and last element",
    },
    {
      input: "[3,2,4]\n6",
      expectedOutput: "[1,2]",
      isSample: true,
      weight: 10,
      explanation: "Non-adjacent indices",
    },
    {
      input: "[3,3]\n6",
      expectedOutput: "[0,1]",
      isSample: true,
      weight: 10,
      explanation: "Duplicate values",
    },
    // ── Hidden cases ───────────────────────────────────────────────────────
    {
      input: "[-1,-2,-3,-4,-5]\n-8",
      expectedOutput: "[2,4]",
      isSample: false,
      weight: 35,
      explanation: "All-negative numbers",
    },
    {
      input: "[1000000000,-1000000000,0]\n0",
      expectedOutput: "[0,1]",
      isSample: false,
      weight: 35,
      explanation: "Large integer boundaries",
    },
  ],

  // ── Starter code: complete scripts the user edits ─────────────────────────
  starterCode: {
    javascript: JS_STARTER,
    typescript: TS_STARTER,
    python: PY_STARTER,
    java: JAVA_STARTER,
    cpp: CPP_STARTER,
  },

  solutions: [
    {
      language: "javascript",
      code: JS_STARTER,   // the starter already contains the solution
      explanation: "Single-pass hash map — store index, look up complement in O(1).",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
    },
  ],

  author: "Admin",
  totalSubmissions: 0,
  acceptedSubmissions: 0,
  acceptanceRate: 0,
  likes: 0,
  dislikes: 0,
};

// ─── Upsert ───────────────────────────────────────────────────────────────────
try {
  const existing = await Problem.findOne({ slug: "two-sum" });
  if (existing) {
    await Problem.findOneAndUpdate(
      { slug: "two-sum" },
      {
        $set: {
          testCases: twoSum.testCases,
          starterCode: twoSum.starterCode,
          solutions: twoSum.solutions,
          examples: twoSum.examples,
          description: twoSum.description,
          constraints: twoSum.constraints,
          hints: twoSum.hints,
          status: "Published",
        },
      }
    );
    console.log('✅  "Two Sum" updated with correct test cases and starter code.');
  } else {
    await Problem.create(twoSum);
    console.log('✅  "Two Sum" seeded successfully.');
  }
} catch (err) {
  console.error("❌  Seed failed:", err.message);
} finally {
  process.exit(0);
}
