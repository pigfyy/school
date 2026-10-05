// Section 1 classes, copied from the slides and the official worksheet solutions,
// plus our completion of UnlikePair (slide 18 "replace the Ts").
class Animal { public String toString() { return getClass().getSimpleName(); } }
class Dog extends Animal {}
class Cat extends Animal {}

class IntPair {
    private int first; private int second;
    public IntPair(int first, int second){ this.first = first; this.second = second; }
    public int getFirst(){ return first; } public int getSecond(){ return second; }
    public void setFirst(int newFirst){ this.first = newFirst; } public void setSecond(int newSecond){ this.second = newSecond; }
}
class LikePair<T> {
    private T first; private T second;
    public LikePair(T first, T second){ this.first = first; this.second = second; }
    public T getFirst(){ return first; } public T getSecond(){ return second; }
    public void setFirst(T newFirst){ this.first = newFirst; } public void setSecond(T newSecond){ this.second = newSecond; }
    public String toString(){ return "(" + first + "," + second + ")"; }
}
class UnlikePair<A,B> {
    private A first; private B second;
    public UnlikePair(A first, B second){ this.first = first; this.second = second; }
    public A getFirst(){ return first; } public B getSecond(){ return second; }
    public void setFirst(A newFirst){ this.first = newFirst; } public void setSecond(B newSecond){ this.second = newSecond; }
}
class Tuple<T> {
    private final T[] data;
    @SuppressWarnings("unchecked")
    public Tuple(T[] tuple){
        data = (T[]) new Object[tuple.length];
        for(int i = 0; i < tuple.length; i++){ data[i] = tuple[i]; }
    }
    public T getIth(int i){ return data[i]; } public void setIth(int i, T value){ data[i] = value; }
}
class LikeAnimalPair<T extends Animal> {
    private T first; private T second;
    public LikeAnimalPair(T first, T second){ this.first = first; this.second = second; }
    public T getFirst(){ return first; } public T getSecond(){ return second; }
    public String toString(){ return "(" + first + "," + second + ")"; }
}
class TypeSubtypePair <A, B extends A>{
    private A first; private B second;
    public TypeSubtypePair(A first, B second){ this.first = first; this.second = second; }
    public A getFirst(){ return first; } public B getSecond(){ return second; }
    public void setFirst(A newFirst){ this.first = newFirst; } public void setSecond(B newSecond){ this.second = newSecond; }
    public String toString(){ return "(" + first + "," + second+ ")"; }
}
class IntOtherPair<T>{
    private int first; private T second;
    public IntOtherPair(int first, T second){ this.first = first; this.second = second; }
    public int getFirst(){ return first; } public T getSecond(){ return second; }
    public void setFirst(int newFirst){ this.first = newFirst; } public void setSecond(T newSecond){ this.second = newSecond; }
    public String toString(){ return "(" + first + "," + second+ ")"; }
}
class ItemPairPair<A, B extends A>{
    private A first; private LikePair<B> second;
    public ItemPairPair(A first, LikePair<B> second){ this.first = first; this.second = second; }
    public A getFirst(){ return first; } public LikePair<B> getSecond(){ return second; }
    public void setFirst(A newFirst){ this.first = newFirst; } public void setSecond(LikePair<B> newSecond){ this.second = newSecond; }
    public String toString(){ return "(" + first + "," + second+ ")"; }
}
class ItemArrayPair<A,B>{
    private A first; private B[] second;
    public ItemArrayPair(A first, B[] second){ this.first = first; this.second = second; }
    public A getFirst(){ return first; } public B[] getSecond(){ return second; }
    public void setFirst(A newFirst){ this.first = newFirst; } public void setSecond(B[] newSecond){ this.second = newSecond; }
}
class ComparablePair<A extends Comparable<A>, B extends Comparable<B>> implements Comparable<ComparablePair<A,B>> {
    private A first; private B second;
    public ComparablePair(A first, B second){ this.first = first; this.second = second; }
    public int compareTo(ComparablePair<A,B> other){
        int compare1st = this.first.compareTo(other.first);
        return compare1st!=0 ? compare1st : this.second.compareTo(other.second);
    }
    public String toString(){ return "(" + first + "," + second+ ")"; }
}
// The worksheet's compareTo body (with == instead of !=), kept to show the difference.
class WorksheetComparablePair<A extends Comparable<A>, B extends Comparable<B>> implements Comparable<WorksheetComparablePair<A,B>> {
    private A first; private B second;
    public WorksheetComparablePair(A first, B second){ this.first = first; this.second = second; }
    public int compareTo(WorksheetComparablePair<A,B> other){
        int compare1st = this.first.compareTo(other.first);
        return compare1st==0 ? compare1st : this.second.compareTo(other.second);
    }
}
public class Section1 {
    public static void main(String[] args){
        LikePair<String> lp = new LikePair<>("A","B");
        UnlikePair<String,Integer> up = new UnlikePair<>("x", 3);
        Tuple<String> t = new Tuple<>(new String[]{"a","b"});
        LikeAnimalPair<Animal> ap = new LikeAnimalPair<>(new Dog(), new Cat());
        TypeSubtypePair<Animal, Dog> ts = new TypeSubtypePair<>(new Cat(), new Dog());
        IntOtherPair<String> io = new IntOtherPair<>(3, "x");
        ItemPairPair<Animal, Dog> ipp = new ItemPairPair<>(new Cat(), new LikePair<>(new Dog(), new Dog()));
        ItemArrayPair<String,Integer> iap = new ItemArrayPair<>("x", new Integer[]{1,2});
        ComparablePair<Integer,String> c1 = new ComparablePair<>(1, "z"), c2 = new ComparablePair<>(2, "a");
        WorksheetComparablePair<Integer,String> w1 = new WorksheetComparablePair<>(1, "z"), w2 = new WorksheetComparablePair<>(2, "a");
        System.out.println("lp=" + lp + " ap=" + ap + " ts=" + ts + " io=" + io + " ipp=" + ipp + " t1=" + t.getIth(1) + " up2=" + up.getSecond() + " iap=" + iap.getSecond().length);
        System.out.println("solution (1,z) vs (2,a): " + Integer.signum(c1.compareTo(c2)));
        System.out.println("worksheet (1,z) vs (2,a): " + Integer.signum(w1.compareTo(w2)));
    }
}
