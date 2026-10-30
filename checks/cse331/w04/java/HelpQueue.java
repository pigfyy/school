import java.util.List;

/**
 * The queue for office hours: the students waiting for help, in
 * the order they joined. A student is named by their NetID, and a
 * student is in the queue at most once.
 */
public interface HelpQueue {
    /** @return the number of students waiting */
    int size();

    /**
     * @modifies this
     * @effects adds the student at the back of the queue
     * @throws IllegalArgumentException if the student is already in
     *     the queue, and leaves the queue unchanged
     */
    void join(String netid);

    /**
     * @modifies this
     * @effects removes the student at the front of the queue
     * @return the NetID of the student removed
     * @throws NoSuchElementException if the queue is empty
     */
    String next();

    /** @return the students waiting, front first, in a new list */
    List<String> waiting();
}
