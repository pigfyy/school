import java.util.*;
/* Lecture 1 and 2 code, copied from the slides and instrumented to count operations.
   Prints one JSON object per line; tests/compare-java.mjs compares each line with site/js/sim.js. */
public class Lecture {
    // ---- Lecture 2, Example 1 (slide 15/16): count arithmetic ops + - * / % ++
    static long ops;
    static int myFunction(List<Integer> n){
        int b, c, i;
        b = 55 + 5; ops++;
        c = b / 3; ops++;
        b = c + 100; ops++;
        for (i = 0; i < n.size(); i++, ops++) { b++; ops++; }
        ops++; // b % 2
        if (b % 2 == 0) { c++; ops++; }
        else { for (i = 0; i < n.size(); i++, ops++) { c++; ops++; } }
        return c;
    }
    // ---- Example 2 (slide 17/18)
    static long prints, adds;
    static void beAnnoying(List<Integer> n){
        List<Integer> m = new ArrayList<>();
        for (int i=0; i < n.size(); i++){
            m.add(n.get(i)); adds++;
            for (int j=0; j< n.size(); j++){ prints++; }
        }
    }
    // ---- ArrayList add (slides 20-21): count writes and copies (indexing)
    static int[] data; static int size; static long writes, copies;
    static void add(int value){
        if(data.length == size) resize();
        data[size] = value; writes++;
        size++;
    }
    static void resize(){
        int[] oldData = data;
        data = new int[data.length*2];
        for(int i = 0; i < oldData.length; i++){ data[i] = oldData[i]; copies++; }
    }
    // ---- searching (slides 23, 25)
    static int linearComparisons(List<Integer> a, int k){
        int cmp = 0;
        for(int i=0; i< a.size(); i++){ cmp++; if (a.get(i) == k) return cmp; }
        return cmp;
    }
    static int binaryIterations(List<Integer> a, int k){
        int it = 0;
        int start = 0; int end = a.size();
        while(start < end){
            it++;
            int mid = start + (end-start)/2;
            if(a.get(mid) == k) return it;
            else if(a.get(mid) < k) start = mid+1;
            else end = mid;
        }
        return it;
    }
    // ---- Lecture 1 circular array queue (slide 18) and linked queue (slide 15)
    static int[] queue; static int front, back, qsize;
    static void enqueue(int x){ queue[back] = x; back = (back + 1) % queue.length; qsize++; }
    static int dequeue(){ int first = queue[front]; front = (front + 1) % queue.length; qsize--; return first; }
    static class ListNode { int value; ListNode next; ListNode(int v){ value = v; } }
    static ListNode lfront, lback;
    static void lenqueue(int x){ ListNode last = new ListNode(x); lback.next = last; lback = last; }
    static int ldequeue(){ int first = lfront.value; lfront = lfront.next; if (lfront == null) {lback = null;} return first; }

    static List<Integer> list(int n){ List<Integer> l = new ArrayList<>(); for (int i=0;i<n;i++) l.add(i); return l; }

    public static void main(String[] args){
        for (int n : new int[]{0,1,2,3,4,5,6,7,10,11,100,999,1000}) {
            ops = 0; myFunction(list(n));
            System.out.println("{\"t\":\"myFunction\",\"n\":"+n+",\"ops\":"+ops+"}");
        }
        for (int n : new int[]{0,1,4,7,10,1000}) {
            prints = 0; adds = 0; beAnnoying(list(n));
            System.out.println("{\"t\":\"beAnnoying\",\"n\":"+n+",\"prints\":"+prints+",\"adds\":"+adds+"}");
        }
        for (int c = 1; c <= 8; c++) for (int m : new int[]{1, c, c+1, 3*c, 7*c, 7*c+1, 100}) {
            data = new int[c]; size = 0; writes = 0; copies = 0;
            for (int k = 0; k < m; k++) add(k);
            System.out.println("{\"t\":\"arrayList\",\"c\":"+c+",\"adds\":"+m+",\"total\":"+(writes+copies)+",\"length\":"+data.length+"}");
        }
        List<Integer> s = Arrays.asList(5, 8, 13, 42, 75, 79, 88, 90, 95, 99);
        for (int k : new int[]{5,8,13,42,75,79,88,90,95,99,1,50,100}) {
            System.out.println("{\"t\":\"search\",\"k\":"+k+",\"binary\":"+binaryIterations(s,k)+",\"linear\":"+linearComparisons(s,k)+"}");
        }
        for (int n : new int[]{1,2,3,4,7,8,10,15,16,100,1000,1024}) {
            List<Integer> a = new ArrayList<>(); for (int i=0;i<n;i++) a.add(2*i);
            int worst = 0; for (int k = -1; k <= 2*n-1; k++) worst = Math.max(worst, binaryIterations(a,k));
            System.out.println("{\"t\":\"binaryWorst\",\"n\":"+n+",\"worst\":"+worst+"}");
        }
        // Lecture 1 traces
        queue = new int[10]; front = 0; back = 0; qsize = 0;
        for (int x : new int[]{5,8,3,4,7}) enqueue(x);
        dequeue(); dequeue(); enqueue(9);
        System.out.println("{\"t\":\"circ1\",\"front\":"+front+",\"back\":"+back+",\"size\":"+qsize+"}");
        queue = new int[10]; front = 0; back = 0; qsize = 0;
        for (int x : new int[]{5,8,3,4,7}) enqueue(x);
        for (int i=0;i<3;i++) dequeue();
        for (int x=1;x<=6;x++) enqueue(x);
        System.out.println("{\"t\":\"circ2\",\"front\":"+front+",\"back\":"+back+",\"size\":"+qsize+",\"q0\":"+queue[0]+"}");
        queue = new int[10]; front = 0; back = 0; qsize = 0;
        for (int x : new int[]{5,8,3,4,7}) enqueue(x);
        for (int i=0;i<3;i++) dequeue();
        for (int x=1;x<=7;x++) enqueue(x);
        System.out.println("{\"t\":\"circ3\",\"back\":"+back+"}");
        queue = new int[10]; front = 0; back = 0; qsize = 0;
        for (int x : new int[]{5,8,3,4,7}) enqueue(x);
        enqueue(1); enqueue(2);
        System.out.println("{\"t\":\"circ4\",\"back\":"+back+"}");
        lfront = new ListNode(5); lback = lfront;
        for (int x : new int[]{8,3,4,7}) lenqueue(x);
        ldequeue(); int second = ldequeue(); lenqueue(9);
        System.out.println("{\"t\":\"linked1\",\"second\":"+second+",\"front\":"+lfront.value+",\"back\":"+lback.value+"}");
        // stacks
        Deque<Integer> st = new ArrayDeque<>();
        st.push(5); st.push(8); st.push(3); st.pop(); st.push(4); int p2 = st.pop();
        Deque<Integer> st2 = new ArrayDeque<>(); st2.push(1); st2.push(2); st2.push(3); st2.pop();
        System.out.println("{\"t\":\"stack\",\"secondPop\":"+p2+",\"peek\":"+st2.peek()+"}");
        // crossovers, exact with long arithmetic over hundredths
        int ab = -1, ca = -1;
        for (long n = 1; n <= 100000; n++) {
            long A = (10*n+900)*100, B = (100*n-50)*100, C = n*n;
            if (ab < 0 && A < B) ab = (int) n;
            if (ca < 0 && C > A) ca = (int) n;
        }
        System.out.println("{\"t\":\"cross\",\"aBelowB\":"+ab+",\"cAboveA\":"+ca+"}");
        System.out.println("{\"t\":\"bigPrints\",\"value\":\""+(1000000L*1000000L)+"\"}");
    }
}
