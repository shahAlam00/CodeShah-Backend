/**
 * Wraps user code with driver code so Judge0 can run it like LeetCode.
 * The wrapper parses stdin (test input) and calls the user's function/class dynamically.
 */

// ── Language IDs ────────────────────────────────────────────────────────
const JS   = 93;
const TS   = 94;
const PY   = 71;
const JAVA = 62;
const CPP  = 54;

export const getWrappedCode = (languageId, userCode, testInput) => {

    // ── JavaScript / TypeScript (93, 94) ──────────────────────────────────────
    if (languageId === JS || languageId === TS) {
        return `
${userCode}

// --- Driver ---
(function () {
    const inputStr = \`${testInput ? testInput.replace(/`/g, '\\`') : ''}\`.trim();
    const lines = inputStr.split('\\n').map(l => l.trim()).filter(Boolean);
    
    let args = [];
    try {
        args = lines.map(l => JSON.parse(l));
    } catch(e) {
        args = lines;
    }

    // Dynamic function name detection for JS/TS
    const fnMatch = \`${userCode.replace(/`/g, '\\`')}\`.match(/(?:function\\s+(\\w+)|const\\s+(\\w+)\\s*=|var\\s+(\\w+)\\s*=|let\\s+(\\w+)\\s*=)/);
    const fnName = fnMatch ? (fnMatch[1] || fnMatch[2] || fnMatch[3] || fnMatch[4]) : null;

    let result;
    if (fnName && typeof eval(fnName) === 'function') {
        result = eval(fnName)(...args);
    } else if (typeof Solution !== 'undefined') {
        const sol = new Solution();
        const method = Object.getOwnPropertyNames(Solution.prototype).find(m => m !== 'constructor');
        result = sol[method](...args);
    } else {
        result = 'No callable function found';
    }

    if (result === undefined || result === null) {
        console.log('null');
    } else if (typeof result === 'object') {
        console.log(JSON.stringify(result));
    } else {
        console.log(result);
    }
})();
`;
    }

    // ── Python 3 (71) ─────────────────────────────────────────────────────────
    if (languageId === PY) {
        return `
import sys
import json
import inspect
import types

${userCode}

# --- Driver ---
if __name__ == "__main__":
    raw = """${testInput ? testInput : ''}""".strip()
    lines = [l.strip() for l in raw.split('\\n') if l.strip()]
    
    args = []
    for line in lines:
        try:
            args.append(json.loads(line))
        except Exception:
            args.append(line)
    
    result = None
    if 'Solution' in globals() and inspect.isclass(Solution):
        sol = Solution()
        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]
        if methods:
            result = getattr(sol, methods[0])(*args)
    else:
        fns = [(k, v) for k, v in globals().items() if isinstance(v, types.FunctionType) and not k.startswith('_')]
        if fns:
            result = fns[0][1](*args)
    
    if result is None:
        print("null")
    elif isinstance(result, (list, dict, bool)):
        print(json.dumps(result))
    else:
        print(result)
`;
    }

    // ── Java (62) ─────────────────────────────────────────────────────────────
    if (languageId === JAVA) {
        return `
import java.util.*;
import java.lang.reflect.*;

${userCode}

public class Main {
    public static void main(String[] args) throws Exception {
        String raw = "${testInput ? testInput.replace(/"/g, '\\"').replace(/\n/g, '\\n') : ''}".trim();
        String[] lines = raw.split("\\\\n");
        
        List<Object> parsedArgs = new ArrayList<>();
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;
            if (line.startsWith("[")) {
                line = line.replace("[","").replace("]","").trim();
                if (line.isEmpty()) { parsedArgs.add(new int[0]); continue; }
                String[] parts = line.split(",");
                int[] arr = new int[parts.length];
                for (int i = 0; i < parts.length; i++) arr[i] = Integer.parseInt(parts[i].trim());
                parsedArgs.add(arr);
            } else {
                try { parsedArgs.add(Integer.parseInt(line)); }
                catch (NumberFormatException e) { parsedArgs.add(line); }
            }
        }
        
        Solution sol = new Solution();
        Method[] methods = Solution.class.getDeclaredMethods();
        // Dynamic method selection (ignores internal java methods)
        Method targetMethod = null;
        for (Method m : methods) {
            if (!m.isSynthetic() && !Modifier.isStatic(m.getModifiers())) {
                targetMethod = m;
                break;
            }
        }
        
        Object result = targetMethod.invoke(sol, parsedArgs.toArray());
        
        if (result == null) System.out.println("null");
        else if (result instanceof int[]) System.out.println(Arrays.toString((int[]) result).replace(" ", ""));
        else if (result instanceof boolean[]) System.out.println(Arrays.toString((boolean[]) result));
        else System.out.println(result);
    }
}
`;
    }

    // ── C++ (54) ──────────────────────────────────────────────────────────────
    if (languageId === CPP) {
        // Dynamic C++ function name detection using Regex from user code inside class Solution
        const match = userCode.match(/(?:vector<int>|int|string|bool|double|char|void|vector<vector<int>>)\s+([a-zA-Z0-9_]+)\s*\([^)]*\)/);
        const methodName = match ? match[1] : "solve"; // Fallback if name not matched

        return `
#include <iostream>
#include <vector>
#include <sstream>
#include <string>
#include <algorithm>

using namespace std;

// --- User Code ---
${userCode}

// --- Driver Code ---
int main() {
    string input = "${testInput ? testInput.replace(/\n/g, '\\n') : ''}";
    input.erase(remove(input.begin(), input.end(), '['), input.end());
    input.erase(remove(input.begin(), input.end(), ']'), input.end());
    
    stringstream ss(input);
    string val;
    vector<int> nums;
    while (getline(ss, val, ',')) {
        if(!val.empty()) {
            // Trim spaces if any
            val.erase(remove(val.begin(), val.end(), ' '), val.end());
            if(!val.empty()) nums.push_back(stoi(val));
        }
    }

    Solution sol;
    vector<int> result = sol.${methodName}(nums);
    
    cout << "[";
    for(size_t i = 0; i < result.size(); i++) {
        cout << result[i] << (i == result.size() - 1 ? "" : ",");
    }
    cout << "]" << endl;
    return 0;
}
`;
    }

    // Fallback — return as-is
    return userCode;
};