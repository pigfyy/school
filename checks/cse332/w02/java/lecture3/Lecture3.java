import java.math.BigInteger;
import java.util.*;

/* Lecture 3 (Algorithm Analysis 2) ground truth.
   1. The slide-6 and slide-8 search code, copied from the slides and instrumented to count work.
   2. Exact BigInteger answers for every crossover / n0 question on the site, computed independently of
      site/js/*.js (tests/verify-answers.mjs compares them).
   Prints one JSON object per line. */
public class Lecture3 {
    // ---- slide 6: contains (count a.get(i) == k comparisons)
    static int containsComparisons(List<Integer> a, int k){
        int cmp = 0;
        for(int i=0; i< a.size(); i++){
            cmp++;
            if (a.get(i) == k)
                return cmp;
        }
        return cmp;
    }
    // ---- slide 8: binary_contains (count loop iterations; record end-start at the top of each iteration)
    static List<Integer> gaps = new ArrayList<>();
    static int binaryIterations(List<Integer> a, int k){
        gaps.clear();
        int it = 0;
        int start = 0;
        int end = a.size();
        while(start < end){
            it++;
            gaps.add(end - start);
            int mid = start + (end-start)/2;
            if(a.get(mid) == k)
                return it;
            else if(a.get(mid) < k)
                start = mid+1;
            else
                end = mid;
        }
        return it;
    }
    static boolean binary_contains(List<Integer> a, int k){
        int start = 0;
        int end = a.size();
        while(start < end){
            int mid = start + (end-start)/2;
            if(a.get(mid) == k)
                return true;
            else if(a.get(mid) < k)
                start = mid+1;
            else
                end = mid;
        }
        return false;
    }
    // worst case over every target: each present value and each gap (values 0,2,4,...)
    static int binaryWorst(int n){
        List<Integer> a = new ArrayList<>(n);
        for (int i = 0; i < n; i++) a.add(2*i);
        int worst = 0;
        for (int k = -1; k <= 2*n - 1; k++) worst = Math.max(worst, binaryIterations(a, k));
        return worst;
    }

    static BigInteger B(long x){ return BigInteger.valueOf(x); }
    static String gapsJson(){ StringBuilder sb = new StringBuilder("["); for (int i = 0; i < gaps.size(); i++){ if(i>0) sb.append(','); sb.append(gaps.get(i)); } return sb.append(']').toString(); }

    public static void main(String[] args){
        List<Integer> slide = Arrays.asList(5, 8, 13, 42, 75, 79, 88, 90, 95, 99);
        // search on the slide list for every k from 0 to 100
        for (int k = 0; k <= 100; k++){
            int it = binaryIterations(slide, k);
            System.out.println("{\"t\":\"search\",\"k\":" + k + ",\"binary\":" + it + ",\"found\":" + binary_contains(slide, k) + ",\"linear\":" + containsComparisons(slide, k) + ",\"gaps\":" + gapsJson() + "}");
        }
        for (int n : new int[]{1, 2, 3, 4, 5, 7, 8, 9, 10, 15, 16, 17, 31, 32, 33, 100, 1000, 1023, 1024, 1025, 4096, 100000, 1048576, 1000000}){
            System.out.println("{\"t\":\"binaryWorst\",\"n\":" + n + ",\"worst\":" + binaryWorst(n) + "}");
        }
        // linear search worst case for n = 1,000,000 (target missing)
        { List<Integer> a = new ArrayList<>(); for (int i = 0; i < 1000000; i++) a.add(i); System.out.println("{\"t\":\"linearWorst\",\"n\":1000000,\"comparisons\":" + containsComparisons(a, -1) + "}"); }

        // ---- Example 1 (slides 21-23): 10n + 100 <= c n^2.  Smallest n0 for c = 10 (the inequality stays true after: n(n-1) increasing)
        { int first = -1; for (int n = 1; n <= 1000; n++){ boolean ok = 10*n + 100 <= 10*n*n; if (ok && first < 0) first = n; if (!ok) first = -1; }
          System.out.println("{\"t\":\"ex1\",\"c\":10,\"smallestN0\":" + first + ",\"holdsAt10\":" + (10*10+100 <= 10*100) + "}"); }
        // ---- Example 2 (slides 24-26): 13n^2 - 50n >= c n^2.  c = 12 -> smallest n0; c = 1 -> smallest n0
        for (int c : new int[]{12, 1, 11}){ long first = -1; for (long n = 1; n <= 10000; n++){ boolean ok = 13*n*n - 50*n >= c*n*n; if (ok && first < 0) first = n; if (!ok) first = -1; }
          System.out.println("{\"t\":\"ex2\",\"c\":" + c + ",\"smallestN0\":" + first + "}"); }
        // c = 13: 13n^2 - 50n >= 13n^2 never holds for n >= 1
        { boolean any = false; for (long n = 1; n <= 100000; n++) if (13*n*n - 50*n >= 13*n*n) any = true; System.out.println("{\"t\":\"ex2c13\",\"anyN\":" + any + "}"); }
        // 4 + 3n <= c n with c = 4: smallest n0
        { long first = -1; for (long n = 1; n <= 1000; n++){ boolean ok = 4 + 3*n <= 4*n; if (ok && first < 0) first = n; if (!ok) first = -1; } System.out.println("{\"t\":\"lin\",\"c\":4,\"smallestN0\":" + first + "}"); }

        // ---- slide 32: n^50 <= 1.1^n  <=>  n^50 * 10^n <= 11^n.  Last n that fails, scanning far past the ratio's peak (n = 525).
        { long lastFail = -1; BigInteger p10 = BigInteger.ONE, p11 = BigInteger.ONE;
          for (int n = 1; n <= 12000; n++){ p10 = p10.multiply(B(10)); p11 = p11.multiply(B(11));
            if (B(n).pow(50).multiply(p10).compareTo(p11) > 0) lastFail = n; }
          System.out.println("{\"t\":\"n50\",\"c\":1,\"lastFail\":" + lastFail + ",\"smallestN0\":" + (lastFail + 1) + "}"); }
        // n^50/1.1^n decreases from n = 525 on: (n+1)^50 * 10 < 11 * n^50
        { int firstDec = -1; for (int n = 1; n <= 2000; n++){ boolean dec = B(n+1).pow(50).multiply(B(10)).compareTo(B(n).pow(50).multiply(B(11))) < 0; if (dec && firstDec < 0) firstDec = n; if (!dec) firstDec = -1; }
          System.out.println("{\"t\":\"n50peak\",\"decreasingFrom\":" + firstDec + "}"); }
        // ---- slide 32: 3^n <= c 2^n.  c = 1000: first n with 3^n > 1000 * 2^n
        { int first = -1; for (int n = 1; n <= 200; n++) if (B(3).pow(n).compareTo(B(1000).multiply(B(2).pow(n))) > 0){ first = n; break; }
          System.out.println("{\"t\":\"threeTwo\",\"c\":1000,\"firstFail\":" + first + "}"); }
        // ---- slide 32: n + 2 log2 n <= 10 log2 n  <=>  n <= 8 log2 n  <=>  2^n <= n^8.  First n >= 2 where it fails.
        { int first = -1; for (int n = 2; n <= 1000; n++) if (B(2).pow(n).compareTo(B(n).pow(8)) > 0){ first = n; break; }
          // and it stays failed afterwards (checked to 1000)
          boolean stays = true; for (int n = Math.max(first,2); n <= 1000; n++) if (B(2).pow(n).compareTo(B(n).pow(8)) <= 0) stays = false;
          System.out.println("{\"t\":\"nlog\",\"c\":10,\"firstFail\":" + first + ",\"stays\":" + stays + "}"); }
        // slide 32's parenthetical for "n > c log n", c = 10: n > 10 log2 n <=> 2^n > n^10 ; vs "2^n / n > 10"
        { int exact = -1; for (int n = 2; n <= 1000; n++) if (B(2).pow(n).compareTo(B(n).pow(10)) > 0){ exact = n; break; }
          int paren = -1; for (int n = 1; n <= 1000; n++) if (B(2).pow(n).compareTo(B(10L*n)) > 0){ paren = n; break; }
          System.out.println("{\"t\":\"paren\",\"c\":10,\"exactFirst\":" + exact + ",\"parenFirst\":" + paren + "}"); }
        // ---- slide 32: log2 n + 2 <= 12  <=>  n <= 2^10.  First n where it fails.
        { long first = -1; for (long n = 1; n <= 5000; n++){ /* log2 n > 10 <=> n > 1024 */ if (B(n).compareTo(B(2).pow(10)) > 0){ first = n; break; } }
          System.out.println("{\"t\":\"logConst\",\"c\":12,\"firstFail\":" + first + "}"); }
        // ---- slide 36: n^(1/10) vs log2 n at n = 2^k: log2 n <= n^(1/10)  <=>  k <= 2^(k/10)  <=>  k^10 <= 2^k
        { int firstHold = -1; for (int k = 2; k <= 200; k++){ boolean ok = B(k).pow(10).compareTo(B(2).pow(k)) <= 0; if (ok && firstHold < 0) firstHold = k; if (!ok) firstHold = -1; }
          System.out.println("{\"t\":\"tenth\",\"firstK\":" + firstHold + ",\"at40\":{\"tenth\":16,\"log\":40,\"k10\":\"" + B(40).pow(10) + "\",\"twoK\":\"" + B(2).pow(40) + "\"}}"); }
        // ---- slide 17: 3n^2 + 17 vs n^2.  Upper: c = 4 -> smallest n0 (n^2 >= 17).  Lower: c = 3 holds from n = 1.
        { long first = -1; for (long n = 1; n <= 1000; n++){ boolean ok = 3*n*n + 17 <= 4*n*n; if (ok && first < 0) first = n; if (!ok) first = -1; }
          boolean lower = true; for (long n = 1; n <= 100000; n++) if (3*n*n + 17 < 3*n*n) lower = false;
          System.out.println("{\"t\":\"sq17\",\"upperC\":4,\"upperSmallestN0\":" + first + ",\"lowerC3AllN\":" + lower + "}"); }
        // ---- log base aside: log_8(n) * 3 == log_2(n) at n = 8^j, exactly: 2^(3j) == 8^j
        { boolean ok = true; for (int j = 0; j <= 30; j++) if (!B(2).pow(3*j).equals(B(8).pow(j))) ok = false; System.out.println("{\"t\":\"logbase\",\"ratio\":3,\"ok\":" + ok + "}"); }
    }
}
