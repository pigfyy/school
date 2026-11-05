import java.util.*;

/* Lectures 4-5 (Priority Queues) and Section 2 ground truth.
   1. The lecture's binary min-heap pseudocode (insert / percolateUp / extract / percolateDown / buildHeap),
      transcribed into Java line for line: 1-based array, arr[0] unused. Ties in percolateDown go to the
      right child, exactly as the pseudocode's "arr[left] < arr[right]" test does.
   2. numUnique from the Section 2 worksheet, instrumented to count loop iterations.
   Runs every scenario the site uses (and many generated ones) and prints one JSON object per line.
   checks/cse332/w02/verify.mjs compares site/cse332/w02/sim.js with this output. */
public class Heap {
    double[] arr;
    int size;
    int swaps;

    Heap(double[] levelOrder) {
        arr = new double[Math.max(16, levelOrder.length + 1)];
        for (int k = 0; k < levelOrder.length; k++) arr[k + 1] = levelOrder[k];
        size = levelOrder.length;
    }

    void resize() { arr = Arrays.copyOf(arr, arr.length * 2); }

    void insert(double item) {
        if (size == arr.length - 1) { resize(); }
        size++;
        arr[size] = item;
        percolateUp(size);
    }

    void percolateUp(int i) {
        int parent = i / 2;
        double val = arr[i];
        while (i > 1 && arr[i] < arr[parent]) {
            arr[i] = arr[parent];
            arr[parent] = val;
            i = parent;
            parent = i / 2;
            swaps++;
        }
    }

    double extract() {
        double theMin = arr[1];
        arr[1] = arr[size];
        size--;
        percolateDown(1);
        return theMin;
    }

    void percolateDown(int i) {
        int left = i * 2;
        int right = i * 2 + 1;
        double val = arr[i];
        while (left <= size) {
            int toSwap = right;
            if (right > size || arr[left] < arr[right]) {
                toSwap = left;
            }
            if (arr[toSwap] < val) {
                arr[i] = arr[toSwap];
                arr[toSwap] = val;
                i = toSwap;
                left = i * 2;
                right = i * 2 + 1;
                swaps++;
            } else { return; }
        }
    }

    // buildHeap, recording the array after each percolateDown(i)
    List<String> buildHeap() {
        List<String> trace = new ArrayList<>();
        for (int i = size; i > 0; i--) {
            percolateDown(i);
            trace.add("[" + i + "," + live() + "]");
        }
        return trace;
    }

    boolean isMinHeap() {
        for (int i = 2; i <= size; i++) if (arr[i] < arr[i / 2]) return false;
        return true;
    }

    String live() {
        StringBuilder sb = new StringBuilder("[");
        for (int k = 1; k <= size; k++) { if (k > 1) sb.append(","); sb.append(num(arr[k])); }
        return sb.append("]").toString();
    }

    static String num(double d) { return d == Math.floor(d) && !Double.isInfinite(d) ? Long.toString((long) d) : Double.toString(d); }
    static String list(double[] a) { StringBuilder sb = new StringBuilder("["); for (int k = 0; k < a.length; k++) { if (k > 0) sb.append(","); sb.append(num(a[k])); } return sb.append("]").toString(); }

    static void insertCase(String name, double[] start, double x) {
        Heap h = new Heap(start);
        h.insert(x);
        System.out.println("{\"t\":\"insert\",\"name\":\"" + name + "\",\"start\":" + list(start) + ",\"x\":" + num(x) + ",\"after\":" + h.live() + ",\"swaps\":" + h.swaps + "}");
    }

    static void extractCase(String name, double[] start) {
        Heap h = new Heap(start);
        double m = h.extract();
        System.out.println("{\"t\":\"extract\",\"name\":\"" + name + "\",\"start\":" + list(start) + ",\"min\":" + num(m) + ",\"after\":" + h.live() + ",\"swaps\":" + h.swaps + "}");
    }

    static void buildCase(String name, double[] start) {
        Heap h = new Heap(start);
        List<String> trace = h.buildHeap();
        System.out.println("{\"t\":\"build\",\"name\":\"" + name + "\",\"start\":" + list(start) + ",\"after\":" + h.live() + ",\"swaps\":" + h.swaps + ",\"trace\":[" + String.join(",", trace) + "],\"heap\":" + h.isMinHeap() + "}");
    }

    // a sequence of operations on an empty heap: x >= 0 inserts x, -1 extracts
    static void seqCase(String name, double[] ops) {
        Heap h = new Heap(new double[0]);
        StringBuilder out = new StringBuilder("[");
        int perOp = 0, maxUp = 0;
        for (double op : ops) {
            int before = h.swaps;
            if (op < 0) { if (out.length() > 1) out.append(","); out.append(num(h.extract())); }
            else { h.insert(op); maxUp = Math.max(maxUp, h.swaps - before); }
        }
        System.out.println("{\"t\":\"seq\",\"name\":\"" + name + "\",\"ops\":" + list(ops) + ",\"out\":" + out + "],\"after\":" + h.live() + ",\"swaps\":" + h.swaps + ",\"heap\":" + h.isMinHeap() + "}");
    }

    // Section 2, question 3, counting iterations of the first loop and of the inner loop
    static void numUnique(String[] values) {
        boolean[] visited = new boolean[values.length];
        int first = 0, inner = 0;
        for (int i = 0; i < values.length; i++) {
            visited[i] = false;
            first++;
        }
        int out = 0;
        for (int i = 0; i < values.length; i++) {
            if (!visited[i]) {
                out += 1;
                for (int j = i; j < values.length; j++) {
                    inner++;
                    if (values[i].equals(values[j])) {
                        visited[j] = true;
                    }
                }
            }
        }
        StringBuilder v = new StringBuilder("[");
        for (int k = 0; k < values.length; k++) { if (k > 0) v.append(","); v.append("\"").append(values[k]).append("\""); }
        System.out.println("{\"t\":\"numUnique\",\"values\":" + v + "],\"out\":" + out + ",\"first\":" + first + ",\"inner\":" + inner + "}");
    }

    static double[] d(double... xs) { return xs; }

    public static void main(String[] args) {
        double[] lecture = d(1, 3, 2, 4, 7, 5, 6, 5, 9);
        // the site's steppers (named as in sim.js HEAP_SCENARIOS)
        insertCase("lecture-1.5", lecture, 1.5);
        insertCase("array-insert", d(2, 4, 3, 7, 5), 1);
        extractCase("lecture-after-1.5", d(1, 1.5, 2, 4, 3, 5, 6, 5, 9, 7));
        extractCase("array-extract", d(1, 4, 2, 5, 6, 9, 7));
        buildCase("lecture-build", d(5, 6, 10, 3, 15, 8, 7, 14, 2, 1));
        // problems, checks and quizzes
        insertCase("p-l4-insert-4", d(2, 5, 3, 9, 6, 4, 8), 4);
        extractCase("p-l4-extract", d(2, 5, 3, 9, 6, 4, 8));
        extractCase("p-l4-larger-child", d(1, 3, 5, 7, 8, 9));
        insertCase("qc-l4-insert-4", lecture, 4);
        extractCase("qc-l4-extract", d(2, 4, 3, 7, 5, 8, 6));
        insertCase("cyu-l4-insert-6", lecture, 6);
        seqCase("p-l5-sequence", d(16, 32, 4, 57, 80, 43, 2, -1));
        buildCase("p-l5-build7", d(7, 6, 5, 4, 3, 2, 1));
        seqCase("p-l5-build7-insert", d(7, 6, 5, 4, 3, 2, 1));
        seqCase("l4-trace-example1", d(5, 6, 1, 3, 8, -1, -1, -1, -1, -1));
        seqCase("l4-trace-example2", d(5, 6, 3, -1, 1, -1, -1, 8, -1, -1));
        seqCase("p-l4-trace", d(9, 4, 7, -1, 2, -1, -1, 6, -1, -1));
        // generated sequences, to compare sim.js with this code on many shapes (ties included)
        long seed = 12345;
        for (int s = 0; s < 300; s++) {
            int len = 1 + s % 40;
            double[] ops = new double[len];
            int live = 0;
            for (int k = 0; k < len; k++) {
                seed = (seed * 1103515245L + 12345L) & 0x7fffffffL;
                if (live > 0 && seed % 4 == 0) { ops[k] = -1; live--; }
                else { ops[k] = (seed / 7) % 30; live++; }
            }
            seqCase("gen-" + s, ops);
        }
        for (int s = 0; s < 120; s++) {
            int len = 1 + s % 31;
            double[] a = new double[len];
            for (int k = 0; k < len; k++) { seed = (seed * 1103515245L + 12345L) & 0x7fffffffL; a[k] = (seed / 11) % 25; }
            buildCase("gen-build-" + s, a);
        }
        // Section 2
        numUnique(new String[] {"a", "b", "c", "d", "e"});
        numUnique(new String[] {"a", "a", "a", "a", "a"});
        numUnique(new String[] {"a", "b", "a", "c", "b"});
        numUnique(new String[] {"a", "b", "c", "d", "e", "f"});
        numUnique(new String[] {"a", "a", "a", "a", "a", "a"});
        numUnique(new String[] {"a", "b", "a", "b"});
        for (int n = 1; n <= 30; n++) {
            String[] distinct = new String[n], same = new String[n];
            for (int k = 0; k < n; k++) { distinct[k] = "v" + k; same[k] = "s"; }
            numUnique(distinct);
            numUnique(same);
        }
    }
}
